'use client';

import {
  ArrowLeft,
  ArrowRight,
  Check,
  ImagePlus,
  LocateFixed,
  MapPin,
  Save,
  Search,
  UploadCloud,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { toast } from 'sonner';

import { useBrandLoading } from '@/components/brand-loading';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input, Select, Textarea } from '@/components/ui/field';
import { saveSubmission, type SubmissionInput } from '@/features/submissions/actions';
import { planAreaUpdate } from '@/features/submissions/area-lookup';
import {
  clampPoint,
  formatCoordinate,
  latitudeRange,
  longitudeRange,
  parseCoordinate,
  type CoordinatePoint,
} from '@/features/submissions/coordinates';
import { MapPinPicker } from '@/features/submissions/map-pin-picker';
import { categoryDefinitions, type DistrictSummary, type ProvinceSummary } from '@/lib/domain';
import { canSubmitFromStep, firstInvalidControl } from '@/lib/form-validation';
import type { Locale } from '@/lib/i18n';
import { withLocale } from '@/lib/i18n';

interface UploadedImage {
  objectKey: string;
  mediaUrl: string;
  name: string;
}

export interface SubmissionFormInitial {
  id: string;
  kind: 'CREATE' | 'UPDATE';
  targetPlaceId?: string;
  nameTh: string;
  nameEn?: string;
  descriptionTh: string;
  descriptionEn?: string;
  addressTh: string;
  provinceCode: string;
  districtCode?: string;
  categoryCode: string;
  latitude: number;
  longitude: number;
  phone?: string;
  website?: string;
  petTypes: Array<'DOG' | 'CAT' | 'SMALL_PET' | 'BIRD' | 'EXOTIC'>;
  indoorAllowed: boolean;
  outdoorAllowed: boolean;
  leashRequired: boolean;
  open24Hours: boolean;
  imageKeys: string[];
}

const steps = [
  ['ข้อมูลพื้นฐาน', 'Basics'],
  ['ตำแหน่ง', 'Location'],
  ['กฎสัตว์เลี้ยง', 'Pet rules'],
  ['หลักฐานและตรวจทาน', 'Evidence & review'],
] as const;

type FieldControl = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

interface ReverseAreaResponse {
  province: { code: string; nameTh: string } | null;
  district: { code: string; nameTh: string } | null;
  matched: string;
}

/** Every step section carries `data-step`, so an invalid control can reveal its own step. */
function stepOf(control: Element) {
  const section = control.closest('[data-step]');
  const index = Number(section?.getAttribute('data-step') ?? 0);
  return Number.isInteger(index) ? index : 0;
}

function controlsOf(scope: HTMLFormElement | Element) {
  return [...scope.querySelectorAll<FieldControl>('input, textarea, select')];
}

export function SubmissionForm({
  locale,
  initial,
}: {
  locale: Locale;
  initial?: SubmissionFormInitial;
}) {
  const router = useRouter();
  const brandLoading = useBrandLoading();
  const isThai = locale === 'th';
  const [step, setStep] = useState(0);
  const [pending, setPending] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [draftId, setDraftId] = useState<string | undefined>(initial?.id);
  const [provinces, setProvinces] = useState<ProvinceSummary[]>([]);
  const [districts, setDistricts] = useState<DistrictSummary[]>([]);
  const [provinceCode, setProvinceCode] = useState(initial?.provinceCode ?? '');
  const [districtCode, setDistrictCode] = useState(initial?.districtCode ?? '');
  const [latitudeText, setLatitudeText] = useState(
    initial?.latitude === undefined ? '' : formatCoordinate(initial.latitude),
  );
  const [longitudeText, setLongitudeText] = useState(
    initial?.longitude === undefined ? '' : formatCoordinate(initial.longitude),
  );
  const [images, setImages] = useState<UploadedImage[]>(
    initial?.imageKeys.map((objectKey, index) => ({
      objectKey,
      mediaUrl: `/api/media/${encodeURIComponent(objectKey)}`,
      name: `${locale === 'th' ? 'รูปหลักฐาน' : 'Evidence'} ${index + 1}`,
    })) ?? [],
  );
  const [formError, setFormError] = useState<string>();
  const [stepAlert, setStepAlert] = useState<string>();
  const [focusTick, setFocusTick] = useState(0);
  const pendingFocus = useRef<FieldControl | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [geocodeResults, setGeocodeResults] = useState<
    Array<{ displayName: string; latitude: number; longitude: number }>
  >([]);
  const [areaNote, setAreaNote] = useState<string>();
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string>();
  const pendingDistrict = useRef<string | undefined>(undefined);
  /**
   * Live copies of the province and its district list. Async callbacks (the
   * reverse lookup and its retry) read these instead of render-time values.
   */
  const provinceCodeRef = useRef(provinceCode);
  const districtsRef = useRef<DistrictSummary[]>([]);
  const areaLookup = useRef<{
    controller?: AbortController;
    key?: string;
    sequence: number;
    retryTimer?: ReturnType<typeof setTimeout>;
  }>({ sequence: 0 });
  const geocodeSequence = useRef(0);

  function changeProvince(code: string) {
    provinceCodeRef.current = code;
    setProvinceCode(code);
    districtsRef.current = [];
    setDistricts([]);
  }

  useEffect(() => {
    void fetch('/api/geography')
      .then((response) => response.json())
      .then((data: { provinces: ProvinceSummary[] }) => setProvinces(data.provinces));
  }, []);
  useEffect(() => {
    if (!provinceCode) return;
    let current = true;
    void fetch(`/api/geography?province=${provinceCode}`)
      .then((response) => response.json())
      .then((data: { districts: DistrictSummary[] }) => {
        // A list for a province the user has already left must not land.
        if (!current || provinceCodeRef.current !== provinceCode) return;
        districtsRef.current = data.districts;
        setDistricts(data.districts);
        // The reverse lookup may have resolved a district before this list arrived.
        const wanted = pendingDistrict.current;
        pendingDistrict.current = undefined;
        if (wanted !== undefined)
          setDistrictCode(
            data.districts.some((district) => district.code === wanted) ? wanted : '',
          );
      });
    return () => {
      current = false;
    };
  }, [provinceCode]);
  useEffect(() => {
    const lookup = areaLookup.current;
    return () => {
      // Unmount: cancel the in-flight lookup and its retry, and drop late answers.
      lookup.sequence += 1;
      lookup.controller?.abort();
      if (lookup.retryTimer) clearTimeout(lookup.retryTimer);
      geocodeSequence.current += 1;
    };
  }, []);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (dirty) event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const progress = useMemo(() => `${((step + 1) / steps.length) * 100}%`, [step]);

  /** The pin follows only fully valid, in-range coordinates; partial typing is ignored. */
  const mapPoint = useMemo<CoordinatePoint | undefined>(() => {
    const latitude = parseCoordinate(latitudeText, 'latitude');
    const longitude = parseCoordinate(longitudeText, 'longitude');
    return latitude === undefined || longitude === undefined ? undefined : { latitude, longitude };
  }, [latitudeText, longitudeText]);

  function setPoint(point: CoordinatePoint) {
    setLatitudeText(formatCoordinate(point.latitude));
    setLongitudeText(formatCoordinate(point.longitude));
    setDirty(true);
    void lookupAreas(point);
  }

  /**
   * Fills province/district from the pin. Fired only by discrete events (map
   * click, marker drag end, coordinate blur, GPS, address pick), never on move.
   */
  async function lookupAreas(point: CoordinatePoint, attempt = 0) {
    const key = `${point.latitude.toFixed(3)},${point.longitude.toFixed(3)}`;
    const state = areaLookup.current;
    // Same pin as last time: keep whatever the user picked by hand.
    if (attempt === 0 && state.key === key) return;
    state.key = key;
    state.controller?.abort();
    if (state.retryTimer) clearTimeout(state.retryTimer);
    state.retryTimer = undefined;
    const controller = new AbortController();
    state.controller = controller;
    // Request id: only the newest lookup may touch the form.
    const sequence = (state.sequence += 1);
    try {
      const response = await fetch(
        `/api/geocode?reverse=1&lat=${point.latitude}&lng=${point.longitude}`,
        { signal: controller.signal },
      );
      if (sequence !== state.sequence) return;
      if (response.status === 429 && attempt === 0) {
        // The shared 1 req/s throttle: wait out one window, then try once more.
        state.retryTimer = setTimeout(() => {
          state.retryTimer = undefined;
          if (state.key === key && sequence === state.sequence) void lookupAreas(point, 1);
        }, 1_200);
        return;
      }
      const data = (await response.json()) as ReverseAreaResponse & { error?: string };
      if (sequence !== state.sequence) return;
      if (!response.ok || data.error) {
        setAreaNote(
          isThai
            ? 'ตรวจหาจังหวัดและอำเภอจากพิกัดไม่สำเร็จ กรุณาเลือกเอง'
            : 'Could not resolve the province and district. Please pick them yourself.',
        );
        return;
      }
      if (!data.province) {
        setAreaNote(
          isThai
            ? 'ไม่พบจังหวัดที่ตรงกับพิกัดนี้ กรุณาเลือกจังหวัดและอำเภอเอง'
            : 'No province matched this pin. Please pick the province and district yourself.',
        );
        return;
      }
      // Current values from refs, not the ones captured when this lookup started.
      const update = planAreaUpdate(
        provinceCodeRef.current,
        districtsRef.current.map((district) => district.code),
        data,
      );
      if (update.kind === 'same-province') {
        // Same province: keep its district list; never clear the user's district.
        if (update.districtCode) setDistrictCode(update.districtCode);
        else if (update.pendingDistrict) pendingDistrict.current = update.pendingDistrict;
      } else if (update.kind === 'new-province') {
        // New province: its districts load in the effect, which then applies this.
        pendingDistrict.current = update.pendingDistrict;
        setDistrictCode('');
        changeProvince(update.provinceCode);
      }
      setAreaNote(
        data.district
          ? isThai
            ? `เติมจังหวัด ${data.province.nameTh} และอำเภอ ${data.district.nameTh} ให้แล้ว`
            : `Filled in ${data.province.nameTh} / ${data.district.nameTh}`
          : isThai
            ? `เติมจังหวัด ${data.province.nameTh} ให้แล้ว ไม่พบอำเภอ กรุณาเลือกอำเภอเอง`
            : `Filled in ${data.province.nameTh}. No district matched, please pick one.`,
      );
    } catch (error) {
      if (controller.signal.aborted) return;
      if (sequence !== state.sequence) return;
      if (error instanceof TypeError)
        setAreaNote(
          isThai
            ? 'ตรวจหาพื้นที่จากพิกัดไม่สำเร็จ กรุณาเลือกเอง'
            : 'Could not resolve the area. Please pick it yourself.',
        );
    }
  }

  function useCurrentLocation() {
    setLocationError(undefined);
    if (!window.isSecureContext) {
      setLocationError(
        isThai
          ? 'เบราว์เซอร์อนุญาตตำแหน่งเฉพาะ https หรือ localhost กรุณากรอกพิกัดเอง'
          : 'Location needs https or localhost. Enter the coordinates instead.',
      );
      return;
    }
    if (!navigator.geolocation) {
      setLocationError(
        isThai
          ? 'เบราว์เซอร์นี้ไม่รองรับการหาตำแหน่ง กรุณากรอกพิกัดเอง'
          : 'This browser cannot read your location. Enter the coordinates instead.',
      );
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        setPoint(
          clampPoint({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          }),
        );
      },
      (error) => {
        setLocating(false);
        setLocationError(
          error.code === error.PERMISSION_DENIED
            ? isThai
              ? 'คุณยังไม่ได้อนุญาตให้เข้าถึงตำแหน่ง กรุณาอนุญาตหรือกรอกพิกัดเอง'
              : 'Location permission was denied. Allow it or enter the coordinates.'
            : error.code === error.TIMEOUT
              ? isThai
                ? 'ขอตำแหน่งไม่ทันเวลา กรุณาลองใหม่หรือกรอกพิกัดเอง'
                : 'Getting your location timed out. Retry or enter the coordinates.'
              : isThai
                ? 'ระบุตำแหน่งไม่ได้ กรุณาลองใหม่หรือกรอกพิกัดเอง'
                : 'Your location is unavailable. Retry or enter the coordinates.',
        );
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 },
    );
  }

  // Native constraint validation cannot focus a control inside a hidden step, so
  // the browser silently blocks submit. Reveal the step first, then report it.
  useEffect(() => {
    const control = pendingFocus.current;
    if (!control) return;
    pendingFocus.current = null;
    control.scrollIntoView({ block: 'center', behavior: 'smooth' });
    control.reportValidity();
    control.focus({ preventScroll: true });
  }, [focusTick]);

  function revealInvalid(control: FieldControl) {
    const target = stepOf(control);
    setStep(target);
    setStepAlert(
      isThai
        ? `กรุณากรอกข้อมูลให้ครบในขั้นตอนที่ ${target + 1}: ${steps[target]?.[0] ?? ''}`
        : `Please complete step ${target + 1}: ${steps[target]?.[1] ?? ''}`,
    );
    pendingFocus.current = control;
    setFocusTick((value) => value + 1);
  }

  /** Returns the first invalid control of one step (or of the whole form). */
  function firstInvalid(scope: HTMLFormElement | Element) {
    return firstInvalidControl(controlsOf(scope));
  }

  function inputFromForm(form: HTMLFormElement): SubmissionInput {
    const values = new FormData(form);
    return {
      id: draftId,
      kind: initial?.kind ?? 'CREATE',
      targetPlaceId: initial?.targetPlaceId,
      nameTh: String(values.get('nameTh') ?? ''),
      nameEn: String(values.get('nameEn') ?? ''),
      descriptionTh: String(values.get('descriptionTh') ?? ''),
      descriptionEn: String(values.get('descriptionEn') ?? ''),
      addressTh: String(values.get('addressTh') ?? ''),
      provinceCode: String(values.get('provinceCode') ?? ''),
      districtCode: String(values.get('districtCode') ?? '') || undefined,
      categoryCode: String(values.get('categoryCode') ?? ''),
      latitude: String(values.get('latitude') ?? ''),
      longitude: String(values.get('longitude') ?? ''),
      phone: String(values.get('phone') ?? ''),
      website: String(values.get('website') ?? ''),
      petTypes: values.getAll('petTypes') as SubmissionInput['petTypes'],
      indoorAllowed: values.get('indoorAllowed') === 'on',
      outdoorAllowed: values.get('outdoorAllowed') === 'on',
      leashRequired: values.get('leashRequired') === 'on',
      open24Hours: values.get('open24Hours') === 'on',
      imageKeys: images.map((image) => image.objectKey),
    };
  }

  async function persist(form: HTMLFormElement, intent: 'draft' | 'submit') {
    setPending(true);
    setFormError(undefined);
    setStepAlert(undefined);
    setFieldErrors({});
    const invalid = firstInvalid(form);
    if (intent === 'submit' && invalid) {
      setPending(false);
      revealInvalid(invalid);
      return;
    }
    const result = await saveSubmission(inputFromForm(form), intent);
    setPending(false);
    if (!result.ok) {
      setFormError(result.formError);
      setFieldErrors(result.fieldErrors ?? {});
      return;
    }
    setDraftId(result.data.id);
    setDirty(false);
    if (intent === 'draft') toast.success(isThai ? 'บันทึกฉบับร่างแล้ว' : 'Draft saved');
    else {
      if (result.data.duplicateCount)
        toast.warning(
          isThai
            ? `พบสถานที่คล้ายกัน ${result.data.duplicateCount} แห่ง ผู้ดูแลจะตรวจสอบ`
            : `${result.data.duplicateCount} possible duplicates will be reviewed`,
        );
      toast.success(isThai ? 'ส่งข้อมูลให้ผู้ดูแลตรวจแล้ว' : 'Submitted for review');
      router.push(withLocale(locale, '/my-submissions'));
      router.refresh();
    }
  }

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const files = [...(event.target.files ?? [])];
    if (images.length + files.length > 8) {
      setFormError(isThai ? 'อัปโหลดได้สูงสุด 8 รูป' : 'Maximum 8 images');
      return;
    }
    setPending(true);
    const loadingToken = brandLoading.begin(
      isThai ? 'กำลังอัปโหลดหลักฐานอย่างปลอดภัย…' : 'Securely uploading evidence…',
      locale,
    );
    try {
      for (const file of files) {
        const body = new FormData();
        body.set('file', file);
        body.set('scope', 'submission');
        if (draftId) body.set('entityId', draftId);
        const response = await fetch('/api/uploads', { method: 'POST', body });
        const result = (await response.json()) as {
          objectKey?: string;
          mediaUrl?: string;
          error?: string;
        };
        if (!response.ok || !result.objectKey || !result.mediaUrl)
          throw new Error(result.error ?? 'Upload failed');
        setImages((current) => [
          ...current,
          { objectKey: result.objectKey!, mediaUrl: result.mediaUrl!, name: file.name },
        ]);
      }
      setDirty(true);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Upload failed');
    } finally {
      brandLoading.end(loadingToken);
      setPending(false);
      event.target.value = '';
    }
  }

  async function geocode(form: HTMLFormElement) {
    const query = String(new FormData(form).get('addressTh') ?? '').trim();
    if (query.length < 3) return;
    // Only the newest search may replace the result list.
    const sequence = (geocodeSequence.current += 1);
    const response = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`);
    const data = (await response.json()) as {
      results?: Array<{ displayName: string; latitude: number; longitude: number }>;
    };
    if (sequence !== geocodeSequence.current) return;
    setGeocodeResults(data.results ?? []);
  }

  function nextStep(form: HTMLFormElement) {
    const section = form.querySelector(`[data-step="${step}"]`);
    const invalid = section ? firstInvalid(section) : undefined;
    if (invalid) {
      revealInvalid(invalid);
      return;
    }
    setStepAlert(undefined);
    setStep((value) => value + 1);
  }

  return (
    // The key handler only blocks implicit submission; it adds no interaction of its own.
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <form
      className="mx-auto max-w-4xl"
      noValidate
      onKeyDown={(event) => {
        // Enter in a single-line field must never submit the whole form.
        if (event.key === 'Enter' && event.target instanceof HTMLInputElement) {
          const type = event.target.type;
          if (type !== 'checkbox' && type !== 'file') event.preventDefault();
        }
      }}
      onSubmit={(event) => {
        event.preventDefault();
        if (!canSubmitFromStep(step, steps.length)) return;
        void persist(event.currentTarget, 'submit');
      }}
      onChange={() => setDirty(true)}
    >
      <div className="mb-8 overflow-hidden rounded-full bg-[var(--sage)]">
        <div className="h-2 bg-[var(--action)] transition-all" style={{ width: progress }} />
      </div>
      <ol
        className="mb-8 grid grid-cols-4 gap-2"
        aria-label={isThai ? 'ขั้นตอนการส่งข้อมูล' : 'Submission steps'}
      >
        {steps.map(([th, en], index) => (
          <li
            key={en}
            className={index <= step ? 'text-[var(--forest)]' : 'text-[var(--text-muted)]'}
          >
            <span
              className={`mx-auto mb-2 grid size-8 place-items-center rounded-full text-xs font-black ${index <= step ? 'bg-[var(--action)] text-[var(--on-action)]' : 'bg-[var(--sage)]'}`}
            >
              {index < step ? <Check className="size-4" /> : index + 1}
            </span>
            <span className="hidden text-center text-xs font-bold sm:block">
              {isThai ? th : en}
            </span>
          </li>
        ))}
      </ol>

      <section className="surface p-6 sm:p-8">
        {stepAlert && (
          <div
            role="alert"
            className="mb-5 rounded-2xl border border-[var(--terracotta)] bg-[var(--terracotta-soft)] p-4 text-sm font-semibold text-[var(--terracotta)]"
          >
            {stepAlert}
          </div>
        )}
        <div
          className={step === 0 ? 'grid gap-5' : 'hidden'}
          aria-hidden={step !== 0}
          data-step={0}
        >
          <div>
            <p className="eyebrow">01 — {isThai ? 'ข้อมูลพื้นฐาน' : 'Basics'}</p>
            <h1 className="mt-2 text-3xl font-black">
              {isThai ? 'สถานที่นี้ชื่ออะไร?' : 'Tell us about the place'}
            </h1>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1.5 text-sm font-bold">
              {isThai ? 'ชื่อภาษาไทย *' : 'Thai name *'}
              <Input
                name="nameTh"
                defaultValue={initial?.nameTh}
                required
                minLength={2}
                maxLength={160}
                aria-invalid={Boolean(fieldErrors.nameTh)}
              />
            </label>
            <label className="grid gap-1.5 text-sm font-bold">
              {isThai ? 'ชื่อภาษาอังกฤษ' : 'English name'}
              <Input name="nameEn" maxLength={160} defaultValue={initial?.nameEn} />
            </label>
          </div>
          <label className="grid gap-1.5 text-sm font-bold">
            {isThai ? 'หมวดหมู่ *' : 'Category *'}
            <Select name="categoryCode" required defaultValue={initial?.categoryCode ?? ''}>
              <option value="" disabled>
                {isThai ? 'เลือกหมวดหมู่' : 'Choose category'}
              </option>
              {categoryDefinitions.map((category) => (
                <option key={category.code} value={category.code}>
                  {isThai ? category.nameTh : category.nameEn}
                </option>
              ))}
            </Select>
          </label>
          <label className="grid gap-1.5 text-sm font-bold">
            {isThai ? 'คำอธิบาย *' : 'Description *'}
            <Textarea
              name="descriptionTh"
              required
              minLength={20}
              maxLength={2000}
              rows={5}
              defaultValue={initial?.descriptionTh}
            />
            <span className="text-xs font-normal text-[var(--text-muted)]">
              {isThai
                ? 'ข้อความธรรมดาเท่านั้น อย่างน้อย 20 ตัวอักษร'
                : 'Plain text only, at least 20 characters'}
            </span>
          </label>
          <label className="grid gap-1.5 text-sm font-bold">
            {isThai ? 'คำอธิบายภาษาอังกฤษ' : 'English description'}
            <Textarea
              name="descriptionEn"
              maxLength={2000}
              rows={3}
              defaultValue={initial?.descriptionEn}
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1.5 text-sm font-bold">
              {isThai ? 'โทรศัพท์' : 'Phone'}
              <Input name="phone" maxLength={40} inputMode="tel" defaultValue={initial?.phone} />
            </label>
            <label className="grid gap-1.5 text-sm font-bold">
              {isThai ? 'เว็บไซต์' : 'Website'}
              <Input
                name="website"
                type="url"
                placeholder="https://"
                defaultValue={initial?.website}
              />
            </label>
          </div>
        </div>

        <div
          className={step === 1 ? 'grid gap-5' : 'hidden'}
          aria-hidden={step !== 1}
          data-step={1}
        >
          <div>
            <p className="eyebrow">02 — {isThai ? 'ตำแหน่ง' : 'Location'}</p>
            <h2 className="mt-2 text-3xl font-black">
              {isThai ? 'ช่วยปักหมุดให้แม่นยำ' : 'Pin the exact location'}
            </h2>
          </div>
          <label className="grid gap-1.5 text-sm font-bold">
            {isThai ? 'ที่อยู่ *' : 'Address *'}
            <Textarea
              name="addressTh"
              required
              minLength={5}
              maxLength={500}
              rows={3}
              defaultValue={initial?.addressTh}
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1.5 text-sm font-bold">
              {isThai ? 'จังหวัด *' : 'Province *'}
              <Select
                name="provinceCode"
                required
                value={provinceCode}
                onChange={(event) => {
                  // A pending district belongs to the previous province.
                  pendingDistrict.current = undefined;
                  setDistrictCode('');
                  changeProvince(event.target.value);
                }}
              >
                <option value="">{isThai ? 'เลือกจังหวัด' : 'Choose province'}</option>
                {provinces.map((province) => (
                  <option key={province.code} value={province.code}>
                    {isThai ? province.nameTh : province.nameEn}
                  </option>
                ))}
              </Select>
            </label>
            <label className="grid gap-1.5 text-sm font-bold">
              {isThai ? 'อำเภอ / เขต' : 'District'}
              <Select
                name="districtCode"
                disabled={!provinceCode}
                value={districtCode}
                onChange={(event) => setDistrictCode(event.target.value)}
              >
                <option value="">{isThai ? 'เลือกอำเภอ' : 'Choose district'}</option>
                {districts.map((district) => (
                  <option key={district.code} value={district.code}>
                    {isThai ? district.nameTh : district.nameEn}
                  </option>
                ))}
              </Select>
            </label>
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--sage)] p-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="grid flex-1 grid-cols-2 gap-3">
                <label className="grid gap-1 text-xs font-bold">
                  Latitude
                  <Input
                    name="latitude"
                    required
                    type="number"
                    step="any"
                    min={latitudeRange.min}
                    max={latitudeRange.max}
                    placeholder="13.7563"
                    value={latitudeText}
                    onChange={(event) => setLatitudeText(event.target.value)}
                    onBlur={() => {
                      if (mapPoint) void lookupAreas(mapPoint);
                    }}
                  />
                </label>
                <label className="grid gap-1 text-xs font-bold">
                  Longitude
                  <Input
                    name="longitude"
                    required
                    type="number"
                    step="any"
                    min={longitudeRange.min}
                    max={longitudeRange.max}
                    placeholder="100.5018"
                    value={longitudeText}
                    onChange={(event) => setLongitudeText(event.target.value)}
                    onBlur={() => {
                      if (mapPoint) void lookupAreas(mapPoint);
                    }}
                  />
                </label>
              </div>
              <Button
                type="button"
                variant="secondary"
                onClick={(event) => void geocode(event.currentTarget.form!)}
              >
                <Search className="size-4" />
                {isThai ? 'ค้นหาจากที่อยู่' : 'Search address'}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={useCurrentLocation}
                disabled={locating}
              >
                <LocateFixed className="size-4" />
                {locating
                  ? isThai
                    ? 'กำลังหาตำแหน่ง…'
                    : 'Locating…'
                  : isThai
                    ? 'ใช้ตำแหน่งปัจจุบัน'
                    : 'Use my location'}
              </Button>
            </div>
            {(areaNote || locationError) && (
              <div className="mt-3 grid gap-1 text-xs">
                {areaNote && (
                  <p role="status" className="font-semibold text-[var(--text-muted)]">
                    {areaNote}
                  </p>
                )}
                {locationError && (
                  <p role="alert" className="font-semibold text-[var(--terracotta)]">
                    {locationError}
                  </p>
                )}
              </div>
            )}
            {geocodeResults.length > 0 && (
              <div className="mt-3 grid gap-2">
                {geocodeResults.map((result) => (
                  <button
                    key={`${result.latitude}-${result.longitude}`}
                    type="button"
                    className="flex items-start gap-2 rounded-xl bg-[var(--surface)] p-3 text-left text-xs hover:ring-2 hover:ring-[var(--forest-bright)]"
                    onClick={() => {
                      setPoint({ latitude: result.latitude, longitude: result.longitude });
                      setGeocodeResults([]);
                    }}
                  >
                    <MapPin className="mt-0.5 size-4 shrink-0 text-[var(--forest)]" />
                    {result.displayName}
                  </button>
                ))}
              </div>
            )}
          </div>
          {step === 1 && <MapPinPicker locale={locale} point={mapPoint} onPick={setPoint} />}
          <p className="flex items-start gap-2 text-sm text-[var(--text-muted)]">
            <MapPin className="mt-0.5 size-4 shrink-0" />
            {isThai
              ? 'หากระบบค้นหาที่อยู่ไม่พร้อม ให้กรอกพิกัดหรือปักหมุดด้วยตัวเองได้เสมอ'
              : 'If address search is unavailable, enter the coordinates manually.'}
          </p>
        </div>

        <div
          className={step === 2 ? 'grid gap-6' : 'hidden'}
          aria-hidden={step !== 2}
          data-step={2}
        >
          <div>
            <p className="eyebrow">03 — {isThai ? 'กฎสัตว์เลี้ยง' : 'Pet rules'}</p>
            <h2 className="mt-2 text-3xl font-black">
              {isThai ? 'เพื่อนแบบไหนเข้าได้บ้าง?' : 'Which pets are welcome?'}
            </h2>
          </div>
          <fieldset>
            <legend className="mb-3 text-sm font-extrabold">
              {isThai ? 'ประเภทสัตว์ *' : 'Pet types *'}
            </legend>
            <div className="flex flex-wrap gap-2">
              {[
                ['DOG', 'สุนัข', 'Dogs'],
                ['CAT', 'แมว', 'Cats'],
                ['SMALL_PET', 'สัตว์เล็ก', 'Small pets'],
                ['BIRD', 'นก', 'Birds'],
                ['EXOTIC', 'สัตว์พิเศษ', 'Exotic pets'],
              ].map(([value, th, en]) => (
                <label key={value} className="cursor-pointer">
                  <input
                    className="peer sr-only"
                    type="checkbox"
                    name="petTypes"
                    value={value}
                    defaultChecked={initial?.petTypes.includes(
                      value as SubmissionFormInitial['petTypes'][number],
                    )}
                  />
                  <span className="inline-flex min-h-10 items-center rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 text-sm font-bold peer-checked:border-[var(--forest-bright)] peer-checked:bg-[var(--sage)] peer-checked:text-[var(--forest)]">
                    {isThai ? th : en}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              ['indoorAllowed', 'อนุญาตพื้นที่ในอาคาร', 'Indoor allowed'],
              ['outdoorAllowed', 'อนุญาตพื้นที่กลางแจ้ง', 'Outdoor allowed'],
              ['leashRequired', 'ต้องใช้สายจูง', 'Leash required'],
              ['open24Hours', 'เปิด 24 ชั่วโมง', 'Open 24 hours'],
            ].map(([name, th, en]) => (
              <label
                key={name}
                className="flex min-h-14 items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 text-sm font-bold"
              >
                {isThai ? th : en}
                <input
                  type="checkbox"
                  name={name}
                  className="size-5 accent-[#2d5a43]"
                  defaultChecked={Boolean(
                    initial?.[
                      name as keyof Pick<
                        SubmissionFormInitial,
                        'indoorAllowed' | 'outdoorAllowed' | 'leashRequired' | 'open24Hours'
                      >
                    ],
                  )}
                />
              </label>
            ))}
          </div>
        </div>

        <div
          className={step === 3 ? 'grid gap-6' : 'hidden'}
          aria-hidden={step !== 3}
          data-step={3}
        >
          <div>
            <p className="eyebrow">04 — {isThai ? 'หลักฐานและตรวจทาน' : 'Evidence & review'}</p>
            <h2 className="mt-2 text-3xl font-black">
              {isThai ? 'เพิ่มรูปเพื่อช่วยผู้ตรวจ' : 'Add helpful evidence'}
            </h2>
          </div>
          <div className="rounded-[24px] border-2 border-dashed border-[var(--border)] bg-[var(--surface-soft)] p-7 text-center">
            <ImagePlus className="mx-auto size-9 text-[var(--forest)]" />
            <p className="mt-3 font-extrabold">
              {isThai ? 'JPEG, PNG หรือ WebP สูงสุด 8 รูป' : 'JPEG, PNG or WebP, up to 8 images'}
            </p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              {isThai
                ? 'รูปละไม่เกิน 5 MB ระบบตรวจชนิดไฟล์จากเนื้อหาจริง'
                : '5 MB each; actual file signatures are verified.'}
            </p>
            <label className="mt-4 inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md bg-[var(--action)] px-5 text-sm font-bold text-[var(--on-action)]">
              <UploadCloud className="size-4" />
              {isThai ? 'เลือกรูป' : 'Choose images'}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="sr-only"
                onChange={(event) => void upload(event)}
                disabled={pending}
              />
            </label>
          </div>
          {images.length > 0 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {images.map((image, index) => (
                <div
                  key={image.objectKey}
                  className="relative overflow-hidden rounded-2xl border bg-[var(--surface)]"
                >
                  <img
                    src={image.mediaUrl}
                    alt={image.name}
                    className="aspect-square w-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setImages((current) =>
                        current.filter((item) => item.objectKey !== image.objectKey),
                      )
                    }
                    className="absolute top-2 right-2 grid size-8 place-items-center rounded-full bg-[var(--surface)] shadow"
                    aria-label={isThai ? `ลบรูป ${index + 1}` : `Remove image ${index + 1}`}
                  >
                    <X className="size-4" />
                  </button>
                  {index === 0 && (
                    <Badge className="absolute bottom-2 left-2">{isThai ? 'ภาพปก' : 'Cover'}</Badge>
                  )}
                </div>
              ))}
            </div>
          )}
          <div className="rounded-2xl border border-[var(--warning-border)] bg-[var(--warning-soft)] p-4 text-sm leading-6">
            <strong>{isThai ? 'ก่อนส่งข้อมูล' : 'Before submitting'}</strong>
            <p>
              {isThai
                ? 'ข้อมูลนี้จะยังไม่แสดงต่อสาธารณะจนกว่าผู้ดูแลจะอนุมัติ และสถานะเป็น VERIFIED'
                : 'This information remains private until an administrator approves it as VERIFIED.'}
            </p>
          </div>
        </div>

        {(formError || Object.keys(fieldErrors).length > 0) && (
          <div
            role="alert"
            className="mt-6 rounded-2xl border border-[var(--terracotta)] bg-[var(--terracotta-soft)] p-4 text-sm font-semibold text-[var(--terracotta)]"
          >
            <p>
              {formError ??
                (isThai ? 'กรุณาตรวจข้อมูลที่ระบุ' : 'Please review the highlighted information')}
            </p>
            {Object.entries(fieldErrors).map(([name, errors]) => (
              <p key={name} className="mt-1">
                {name}: {errors.join(', ')}
              </p>
            ))}
          </div>
        )}
      </section>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          {step > 0 && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setStepAlert(undefined);
                setStep((value) => value - 1);
              }}
            >
              <ArrowLeft className="size-4" />
              {isThai ? 'ย้อนกลับ' : 'Back'}
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          {step === steps.length - 1 && (
            <Button
              variant="secondary"
              type="button"
              disabled={pending}
              onClick={(event) => void persist(event.currentTarget.form!, 'draft')}
            >
              <Save className="size-4" />
              {isThai ? 'บันทึกฉบับร่าง' : 'Save draft'}
            </Button>
          )}
          {step < steps.length - 1 ? (
            // The distinct keys matter: without them React reuses this DOM button as the submit
            // button on the same click, and the browser then submits the form (skipping step 4).
            <Button
              key="next-step"
              type="button"
              onClick={(event) => nextStep(event.currentTarget.form!)}
            >
              {isThai ? 'ถัดไป' : 'Next'}
              <ArrowRight className="size-4" />
            </Button>
          ) : (
            <Button key="submit-form" type="submit" disabled={pending}>
              {pending
                ? isThai
                  ? 'กำลังส่ง…'
                  : 'Submitting…'
                : isThai
                  ? 'ส่งให้ตรวจสอบ'
                  : 'Submit for review'}
              <Check className="size-4" />
            </Button>
          )}
        </div>
      </div>
    </form>
  );
}
