'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  useEffect,
  useRef,
  useState,
  useOptimistic,
  useTransition,
  type FormEvent,
  type ReactNode,
} from 'react';
import {
  Archive,
  ArrowRight,
  Check,
  ClipboardCheck,
  Heart,
  LayoutDashboard,
  MapPinned,
  PawPrint,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Utensils,
  Footprints,
  Moon,
  Weight,
  X,
  RotateCcw,
  Download,
  FileText,
} from 'lucide-react';
import { toast } from 'sonner';

import { BrandLogo } from '@/components/brand-logo';
import { SiteHeader } from '@/components/site-header';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import type { Locale } from '@/lib/i18n';
import { withLocale } from '@/lib/i18n';
import { addHealthRecord, savePet, setPetArchived, togglePetCare } from './actions';
import { bangkokToday, careTasks, type PetSummary, type HealthRecordSummary } from './pet-schema';

type View = 'overview' | 'pets' | 'health' | 'care';
const recordLabels = {
  checkup: ['ตรวจสุขภาพ', 'Checkup'],
  vaccine: ['วัคซีน', 'Vaccine'],
  weight: ['น้ำหนัก', 'Weight'],
  note: ['บันทึกทั่วไป', 'Note'],
} as const;

function photo(pet: Pick<PetSummary, 'species'>) {
  return `/images/pawspace/${pet.species === 'cat' ? 'cat' : pet.species === 'dog' ? 'golden' : 'dog'}.jpg`;
}

function dateLabel(value: string, locale: Locale) {
  return new Intl.DateTimeFormat(locale === 'th' ? 'th-TH' : 'en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Bangkok',
  }).format(new Date(`${value}T12:00:00+07:00`));
}

function Dialog({
  title,
  close,
  children,
}: {
  title: string;
  close: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className="pet-dialog"
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
    >
      <div className="pet-dialog-heading">
        <div>
          <p className="eyebrow">A SPACE OF THEIR OWN</p>
          <h2>{title}</h2>
        </div>
        <button className="pet-icon-button" onClick={close} aria-label="Close / ปิด">
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}

function PetForm({ pet, locale, close }: { pet?: PetSummary; locale: Locale; close: () => void }) {
  const router = useRouter();
  const th = locale === 'th';
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [error, setError] = useState('');
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setErrors({});
    try {
      const result = await savePet(
        Object.fromEntries(new FormData(e.currentTarget)),
        pet?.id,
        locale,
      );
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        setError(
          result.formError ??
            (th ? 'กรุณาตรวจสอบข้อมูลด้านล่าง' : 'Please check the fields below.'),
        );
        return;
      }
      toast.success(th ? 'บันทึกโปรไฟล์แล้ว' : 'Pet profile saved');
      router.refresh();
      close();
    } catch {
      setError(th ? 'เชื่อมต่อไม่สำเร็จ กรุณาลองใหม่' : 'Connection failed. Please try again.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      title={
        pet
          ? th
            ? `แก้ไขโปรไฟล์ ${pet.name}`
            : `Edit ${pet.name}`
          : th
            ? 'สมาชิกใหม่ของครอบครัว'
            : 'A new family member'
      }
      close={close}
    >
      <form onSubmit={submit} className="pet-form">
        <div className="pet-form-note">
          <PawPrint size={24} />
          <p>
            {th
              ? 'เก็บเรื่องราวเล็ก ๆ ของเพื่อนตัวโปรดไว้ด้วยกัน'
              : 'Keep your little friend’s story in one place.'}
            <small>
              {th ? 'โปรไฟล์นี้อยู่ในบัญชีของคุณ' : 'This profile belongs to your account.'}
            </small>
          </p>
        </div>
        <div className="pet-form-grid">
          <Field label={th ? 'ชื่อน้อง' : 'Pet name'} error={errors.name?.[0]}>
            <Input
              name="name"
              required
              maxLength={40}
              defaultValue={pet?.name}
              placeholder="Milo"
            />
          </Field>
          <Field label={th ? 'ประเภท' : 'Species'} error={errors.species?.[0]}>
            <Select name="species" defaultValue={pet?.species ?? 'dog'}>
              <option value="dog">{th ? 'สุนัข' : 'Dog'}</option>
              <option value="cat">{th ? 'แมว' : 'Cat'}</option>
              <option value="other">{th ? 'สัตว์เลี้ยงอื่น ๆ' : 'Other pet'}</option>
            </Select>
          </Field>
          <Field label={th ? 'สายพันธุ์' : 'Breed'} error={errors.breed?.[0]}>
            <Input
              name="breed"
              maxLength={80}
              defaultValue={pet?.breed}
              placeholder="Golden Retriever"
            />
          </Field>
          <Field label={th ? 'เพศ' : 'Sex'} error={errors.sex?.[0]}>
            <Select name="sex" defaultValue={pet?.sex ?? 'unknown'}>
              <option value="unknown">{th ? 'ไม่ระบุ' : 'Not specified'}</option>
              <option value="male">{th ? 'เพศผู้' : 'Male'}</option>
              <option value="female">{th ? 'เพศเมีย' : 'Female'}</option>
            </Select>
          </Field>
          <Field
            label={th ? 'วันเกิด' : 'Birthday'}
            error={errors.birthday?.[0]}
            hint={th ? 'เว้นว่างได้หากไม่ทราบ' : 'Leave blank if unknown.'}
          >
            <Input
              name="birthday"
              type="date"
              min="1900-01-01"
              max={bangkokToday()}
              defaultValue={pet?.birthday}
            />
          </Field>
          <Field label={th ? 'น้ำหนัก (กก.)' : 'Weight (kg)'} error={errors.weight?.[0]}>
            <Input
              name="weight"
              type="number"
              min="0.01"
              max="200"
              step="0.01"
              defaultValue={pet?.weight ?? ''}
              placeholder="0.0"
            />
          </Field>
        </div>
        <Field label={th ? 'สีประจำตัว' : 'Profile colour'} error={errors.color?.[0]}>
          <Select name="color" defaultValue={pet?.color ?? 'peach'}>
            <option value="peach">Peach</option>
            <option value="sage">Sage</option>
            <option value="lavender">Lavender</option>
          </Select>
        </Field>
        <Field
          label={th ? 'เรื่องเล็ก ๆ ของน้อง' : 'A little about your pet'}
          error={errors.notes?.[0]}
        >
          <Textarea
            name="notes"
            maxLength={1000}
            defaultValue={pet?.notes}
            placeholder={
              th ? 'นิสัย สิ่งที่ชอบ หรือข้อควรใส่ใจ' : 'Personality, favourite things, or notes.'
            }
          />
        </Field>
        {error && (
          <p role="alert" className="pet-error">
            {error}
          </p>
        )}
        <div className="pet-form-actions">
          <Button variant="secondary" onClick={close} disabled={busy}>
            {th ? 'ยกเลิก' : 'Cancel'}
          </Button>
          <Button type="submit" disabled={busy}>
            <Check size={17} />
            {busy ? (th ? 'กำลังบันทึก…' : 'Saving…') : th ? 'บันทึกโปรไฟล์' : 'Save profile'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function RecordForm({
  pets,
  petId,
  locale,
  close,
}: {
  pets: PetSummary[];
  petId: string;
  locale: Locale;
  close: () => void;
}) {
  const router = useRouter();
  const th = locale === 'th';
  const [category, setCategory] = useState('checkup');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await addHealthRecord(
        Object.fromEntries(new FormData(e.currentTarget)),
        locale,
      );
      if (!result.ok) {
        setError(
          result.formError ??
            Object.values(result.fieldErrors ?? {})
              .flat()
              .join(' · '),
        );
        return;
      }
      toast.success(th ? 'บันทึกสุขภาพแล้ว' : 'Health record saved');
      router.refresh();
      close();
    } catch {
      setError(th ? 'เชื่อมต่อไม่สำเร็จ กรุณาลองใหม่' : 'Connection failed. Please try again.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog title={th ? 'เพิ่มบันทึกสุขภาพ' : 'Add a health record'} close={close}>
      <form className="pet-form" onSubmit={submit}>
        <div className="pet-form-grid">
          <Field label={th ? 'สัตว์เลี้ยง' : 'Pet'}>
            <Select name="petId" defaultValue={petId}>
              {pets.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={th ? 'ประเภทบันทึก' : 'Record type'}>
            <Select name="category" value={category} onChange={(e) => setCategory(e.target.value)}>
              {Object.entries(recordLabels).map(([key, labels]) => (
                <option key={key} value={key}>
                  {labels[th ? 0 : 1]}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label={th ? 'หัวข้อ' : 'Title'}>
          <Input
            name="title"
            required
            maxLength={100}
            placeholder={th ? 'เช่น ตรวจสุขภาพประจำปี' : 'e.g. Annual checkup'}
          />
        </Field>
        <div className="pet-form-grid">
          <Field label={th ? 'วันที่บันทึก' : 'Record date'}>
            <Input
              name="date"
              type="date"
              required
              min="1900-01-01"
              max={bangkokToday()}
              defaultValue={bangkokToday()}
            />
          </Field>
          <Field label={th ? 'วันติดตาม (ถ้ามี)' : 'Follow-up date (optional)'}>
            <Input name="dueDate" type="date" min="1900-01-01" />
          </Field>
        </div>
        {category === 'weight' && (
          <Field label={th ? 'น้ำหนัก (กก.)' : 'Weight (kg)'}>
            <Input name="value" type="number" required min="0.01" max="200" step="0.01" />
          </Field>
        )}
        <Field label={th ? 'รายละเอียด' : 'Notes'}>
          <Textarea name="note" maxLength={2000} />
        </Field>
        {error && (
          <p className="pet-error" role="alert">
            {error}
          </p>
        )}
        <div className="pet-form-actions">
          <Button variant="secondary" onClick={close} disabled={busy}>
            {th ? 'ยกเลิก' : 'Cancel'}
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? (th ? 'กำลังบันทึก…' : 'Saving…') : th ? 'บันทึกสุขภาพ' : 'Save record'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function WeightChart({ pet, locale }: { pet?: PetSummary; locale: Locale }) {
  const th = locale === 'th';
  const records = [...(pet?.records ?? [])]
    .filter((r) => r.category === 'weight' && r.value !== null)
    .reverse()
    .slice(-8);
  if (!records.length)
    return (
      <div className="pet-chart-empty">
        <Weight size={32} />
        <strong>{th ? 'ทุกการเติบโตมีเรื่องราว' : 'Every little growth has a story'}</strong>
        <p>
          {th
            ? 'เพิ่มบันทึกน้ำหนักเพื่อเริ่มดูกราฟของน้อง'
            : 'Add a weight record to start your pet’s chart.'}
        </p>
      </div>
    );
  const values = records.map((r) => r.value!);
  const low = Math.min(...values) * 0.9;
  const high = Math.max(...values) * 1.1;
  const x = (i: number) => 35 + i * (430 / Math.max(records.length - 1, 1));
  const y = (v: number) => 150 - ((v - low) / (high - low || 1)) * 115;
  const points = records.map((r, i) => `${x(i)},${y(r.value!)}`).join(' ');
  return (
    <div className="pet-weight-chart">
      <svg
        viewBox="0 0 500 195"
        role="img"
        aria-label={th ? `กราฟน้ำหนักของ ${pet?.name}` : `${pet?.name} weight chart`}
      >
        {[35, 80, 125, 160].map((v) => (
          <line
            key={v}
            x1="25"
            x2="480"
            y1={v}
            y2={v}
            stroke="var(--border)"
            strokeDasharray="4 5"
          />
        ))}
        <polygon points={`35,160 ${points} ${x(records.length - 1)},160`} fill="var(--sage)" />
        <polyline
          points={points}
          fill="none"
          stroke="var(--forest-bright)"
          strokeWidth="3"
          strokeLinejoin="round"
        />
        {records.map((r, i) => (
          <g key={r.id}>
            <circle
              cx={x(i)}
              cy={y(r.value!)}
              r="5"
              fill="var(--forest-bright)"
              stroke="var(--surface)"
              strokeWidth="2"
            />
            <text
              x={x(i)}
              y={y(r.value!) - 12}
              textAnchor="middle"
              fontSize="11"
              fill="var(--forest)"
            >
              {r.value} kg
            </text>
            <text x={x(i)} y="184" textAnchor="middle" fontSize="10" fill="var(--text-muted)">
              {r.date.slice(5)}
            </text>
          </g>
        ))}
      </svg>
      <p>
        {th ? 'จากบันทึกน้ำหนักล่าสุดไม่เกิน 8 รายการ' : 'Based on up to 8 latest weight records.'}
      </p>
    </div>
  );
}

function RecordRow({
  record,
  petName,
  locale,
}: {
  record: HealthRecordSummary;
  petName: string;
  locale: Locale;
}) {
  const th = locale === 'th';
  const labels = recordLabels[record.category as keyof typeof recordLabels];
  return (
    <article className="pet-record-row">
      <span className={`pet-round-icon ${record.category === 'weight' ? 'lavender' : 'sage'}`}>
        {record.category === 'weight' ? <Weight size={20} /> : <Heart size={20} />}
      </span>
      <div>
        <span className="pet-small-label">
          {petName} · {labels?.[th ? 0 : 1]}
        </span>
        <h3>
          {record.title}
          {record.value !== null && record.category === 'weight' ? ` · ${record.value} kg` : ''}
        </h3>
        {record.note && <p className="pet-record-note">{record.note}</p>}
        {record.dueDate && (
          <p>
            {th ? 'ติดตาม' : 'Follow-up'}: {dateLabel(record.dueDate, locale)}
          </p>
        )}
      </div>
      <time dateTime={record.date}>{dateLabel(record.date, locale)}</time>
    </article>
  );
}

export function PetsWorkspace({
  pets,
  locale,
  name,
}: {
  pets: PetSummary[];
  locale: Locale;
  name: string;
}) {
  const router = useRouter();
  const th = locale === 'th';
  const [view, setView] = useState<View>('overview');
  const [search, setSearch] = useState('');
  const [archived, setArchived] = useState(false);
  const [selected, setSelected] = useState('');
  const [modal, setModal] = useState<'pet' | 'record' | null>(null);
  const [editing, setEditing] = useState<PetSummary>();
  const [pending, setPending] = useState('');
  const [carePending, startCareTransition] = useTransition();
  const [optimisticPets, updateCare] = useOptimistic(
    pets,
    (current, change: { petId: string; task: string; done: boolean }) =>
      current.map((p) =>
        p.id === change.petId
          ? {
              ...p,
              careToday: change.done
                ? [...new Set([...p.careToday, change.task])]
                : p.careToday.filter((task) => task !== change.task),
            }
          : p,
      ),
  );
  const [today, setToday] = useState(bangkokToday());
  useEffect(() => {
    const check = () => {
      const next = bangkokToday();
      if (next !== today) {
        setToday(next);
        router.refresh();
      }
    };
    const timer = setInterval(check, 60_000);
    window.addEventListener('focus', check);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', check);
    };
  }, [router, today]);
  const active = optimisticPets.filter((p) => !p.archived);
  const current = active.find((p) => p.id === selected) ?? active[0];
  const shown = optimisticPets.filter(
    (p) =>
      p.archived === archived &&
      `${p.name} ${p.breed}`.toLowerCase().includes(search.toLowerCase()),
  );
  const records = active
    .flatMap((p) => p.records.map((r) => ({ ...r, petName: p.name, petId: p.id })))
    .sort((a, b) => b.date.localeCompare(a.date));
  const upcoming = records
    .filter((r) => r.dueDate && r.dueDate >= today)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const done = active.reduce((count, p) => count + p.careToday.length, 0);
  const tabs = [
    { id: 'overview' as const, th: 'ภาพรวมของคุณ', en: 'Your overview', icon: LayoutDashboard },
    { id: 'pets' as const, th: 'เพื่อนตัวโปรด', en: 'My pets', icon: PawPrint },
    { id: 'health' as const, th: 'สมุดสุขภาพ', en: 'Health journal', icon: Heart },
    { id: 'care' as const, th: 'การดูแลประจำวัน', en: 'Daily care', icon: ClipboardCheck },
  ];
  const titles: Record<View, string> = {
    overview: th ? `พื้นที่แห่งความสุขของ ${name}` : `Your happy space, ${name}`,
    pets: th ? 'เพื่อนตัวโปรดของคุณ' : 'Your little companions',
    health: th ? 'ทุกเรื่องสุขภาพของน้อง' : 'A journal of little milestones',
    care: th ? 'เติมความรักในทุกวัน' : 'A little care, every day',
  };
  async function archive(pet: PetSummary) {
    if (
      !pet.archived &&
      !window.confirm(
        th
          ? `เก็บโปรไฟล์ ${pet.name} เข้าคลัง? ประวัติยังอยู่และนำกลับมาได้`
          : `Archive ${pet.name}? Their history is preserved and can be restored.`,
      )
    )
      return;
    setPending(pet.id);
    try {
      const result = await setPetArchived(pet.id, !pet.archived, locale);
      if (!result.ok) toast.error(result.formError);
      else {
        toast.success(th ? 'อัปเดตโปรไฟล์แล้ว' : 'Profile updated');
        router.refresh();
      }
    } catch {
      toast.error(th ? 'เชื่อมต่อไม่สำเร็จ' : 'Connection failed');
    } finally {
      setPending('');
    }
  }
  function care(petId: string, task: string, checked: boolean) {
    startCareTransition(async () => {
      updateCare({ petId, task, done: checked });
      try {
        const result = await togglePetCare({ petId, task, done: checked }, locale);
        if (!result.ok) toast.error(result.formError);
        else router.refresh();
      } catch {
        toast.error(th ? 'เชื่อมต่อไม่สำเร็จ' : 'Connection failed');
      }
    });
  }
  function exportData() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), pets }, null, 2)], {
        type: 'application/json',
      }),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = `pethub-pets-${today}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
  const petSelector = (
    <label className="pet-filter-label">
      {th ? 'เลือกสัตว์เลี้ยง' : 'Select pet'}
      <Select value={current?.id ?? ''} onChange={(e) => setSelected(e.target.value)}>
        {active.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </Select>
    </label>
  );
  const careList = (entries: PetSummary[]) => (
    <div className="pet-care-list">
      {entries.map((p) => (
        <section key={p.id} className="pet-care-group">
          <h3>
            <PawPrint size={18} />
            {p.name}
            <small>{p.careToday.length}/3</small>
          </h3>
          {careTasks.map((task, i) => {
            const Icon = [Utensils, Footprints, Moon][i]!;
            const checked = p.careToday.includes(task.id);
            return (
              <label key={task.id} className={`pet-care-item ${checked ? 'is-done' : ''}`}>
                <span className="pet-round-icon sage">
                  <Icon size={19} />
                </span>
                <span>
                  <strong>{task[locale]}</strong>
                  <small>{task.time}</small>
                </span>
                <input
                  type="checkbox"
                  aria-label={`${p.name}: ${task[locale]}`}
                  checked={checked}
                  disabled={Boolean(pending) || carePending}
                  onChange={(e) => void care(p.id, task.id, e.target.checked)}
                />
              </label>
            );
          })}
        </section>
      ))}
    </div>
  );
  return (
    <>
      <SiteHeader locale={locale} />
      <div className="pet-workspace">
        <aside className="pet-sidebar">
          <div className="pet-sidebar-brand">
            <BrandLogo />
            <p>YOUR LITTLE HAPPY SPACE</p>
          </div>
          <nav aria-label={th ? 'เมนูสัตว์เลี้ยง' : 'Pet workspace'}>
            {tabs.map((tab) => (
              <button
                key={tab.id}
                aria-current={view === tab.id ? 'page' : undefined}
                className={view === tab.id ? 'active' : ''}
                onClick={() => setView(tab.id)}
              >
                <tab.icon size={19} />
                <span>{tab[locale]}</span>
                {tab.id === 'pets' && <small>{active.length}</small>}
              </button>
            ))}
          </nav>
          <div className="pet-sidebar-note">
            <Heart size={27} />
            <strong>
              {th ? 'โลกใบเล็กของเขา' : 'Their little world.'}
              <br />
              {th ? 'ความรักใบใหญ่ของคุณ' : 'Your biggest love.'}
            </strong>
            <p>
              {th
                ? 'ดูแลให้ดี แล้วออกไปสร้างความทรงจำด้วยกัน'
                : 'Care for them, then make memories together.'}
            </p>
          </div>
          <a href={withLocale(locale, '/explore')} className="pet-sidebar-map">
            <MapPinned size={19} />
            {th ? 'ออกไปสำรวจด้วยกัน' : 'Explore together'}
            <ArrowRight size={17} />
          </a>
        </aside>
        <main className="pet-main">
          <div className="pet-workspace-toolbar">
            <span>{dateLabel(today, locale)}</span>
            <button className="pet-export" onClick={exportData}>
              <Download size={16} />
              {th ? 'ดาวน์โหลดข้อมูล' : 'Export data'}
            </button>
          </div>
          <header className="pet-page-heading">
            <div>
              <p className="eyebrow">A LITTLE CARE. A LOT OF LOVE.</p>
              <h1>
                {titles[view]}
                <span> ✳</span>
              </h1>
              <p>
                {th
                  ? 'เก็บทุกเรื่องสำคัญของน้อง แล้วใช้เวลาดี ๆ ไปด้วยกัน'
                  : 'Keep their little details close. Make more happy days together.'}
              </p>
            </div>
            <div className="pet-heading-actions">
              {view === 'health' && active.length > 0 ? (
                <Button onClick={() => setModal('record')}>
                  <Plus size={17} />
                  {th ? 'เพิ่มบันทึกสุขภาพ' : 'Add health record'}
                </Button>
              ) : (
                <Button
                  onClick={() => {
                    setEditing(undefined);
                    setModal('pet');
                  }}
                >
                  <Plus size={17} />
                  {th ? 'เพิ่มสัตว์เลี้ยง' : 'Add a pet'}
                </Button>
              )}
            </div>
          </header>
          {view === 'overview' && (
            <>
              <section className="pet-welcome">
                <div>
                  <span className="pet-welcome-kicker">
                    <Sparkles size={15} /> LITTLE PAWS, BIG LOVE
                  </span>
                  <h2>
                    {th ? 'ความสุขเล็ก ๆ' : 'Little moments.'}
                    <br />
                    {th ? 'ที่อยากดูแลให้ดีที่สุด' : 'A whole lot of love.'}
                  </h2>
                  <p>
                    {th
                      ? 'สุขภาพ กิจวัตร และการเดินทางของเพื่อนตัวโปรด อยู่ใกล้คุณในที่เดียว'
                      : 'Health, everyday care, and your next adventure. All in one little space.'}
                  </p>
                  <a href={withLocale(locale, '/explore')}>
                    {th ? 'หาที่เที่ยวให้น้อง' : 'Find your next adventure'}
                    <ArrowRight size={17} />
                  </a>
                </div>
                <div className="pet-welcome-photo">
                  <Image
                    src="/images/pawspace/golden.jpg"
                    alt={
                      th
                        ? 'ภาพประกอบสุนัขโกลเด้นรีทรีฟเวอร์'
                        : 'Illustration photo of a golden retriever'
                    }
                    width={420}
                    height={320}
                    priority
                  />
                  <span>
                    <Heart size={16} /> HAPPY PETS, HAPPY HUMANS
                  </span>
                </div>
              </section>
              <section
                className="pet-stats"
                aria-label={th ? 'ภาพรวมสัตว์เลี้ยง' : 'Pet statistics'}
              >
                {[
                  {
                    label: th ? 'เพื่อนตัวโปรด' : 'Little companions',
                    value: active.length,
                    icon: PawPrint,
                    color: 'peach',
                  },
                  {
                    label: th ? 'บันทึกสุขภาพ' : 'Health memories',
                    value: records.length,
                    icon: Heart,
                    color: 'lavender',
                  },
                  {
                    label: th ? 'ดูแลวันนี้แล้ว' : 'Care completed today',
                    value: `${done}/${active.length * 3}`,
                    icon: ClipboardCheck,
                    color: 'sage',
                  },
                ].map((stat) => (
                  <article key={stat.label}>
                    <span className={`pet-round-icon ${stat.color}`}>
                      <stat.icon size={21} />
                    </span>
                    <div>
                      <strong>{stat.value}</strong>
                      <p>{stat.label}</p>
                    </div>
                  </article>
                ))}
              </section>
            </>
          )}
          {(view === 'pets' || view === 'overview') && (
            <section className="pet-section">
              <div className="pet-section-heading">
                <div>
                  <p className="eyebrow">THEIR OWN LITTLE SPACE</p>
                  <h2>{th ? 'สมาชิกในครอบครัว' : 'Meet your family'}</h2>
                </div>
                {view === 'overview' && (
                  <button onClick={() => setView('pets')} className="pet-text-link">
                    {th ? 'ดูทั้งหมด' : 'View all'}
                    <ArrowRight size={16} />
                  </button>
                )}
              </div>
              {view === 'pets' && (
                <div className="pet-list-tools">
                  <div className="pet-list-tabs">
                    <button
                      className={!archived ? 'active' : ''}
                      onClick={() => setArchived(false)}
                    >
                      {th ? 'ทั้งหมด' : 'Active'} ({active.length})
                    </button>
                    <button className={archived ? 'active' : ''} onClick={() => setArchived(true)}>
                      {th ? 'คลังโปรไฟล์' : 'Archived'} ({pets.length - active.length})
                    </button>
                  </div>
                  <label className="pet-search">
                    <Search size={17} />
                    <input
                      aria-label={th ? 'ค้นหาสัตว์เลี้ยง' : 'Search pets'}
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder={th ? 'ค้นหาชื่อหรือสายพันธุ์' : 'Search name or breed'}
                    />
                  </label>
                </div>
              )}
              <div className="pet-card-grid">
                {(view === 'overview' ? active.slice(0, 3) : shown).map((p) => (
                  <article key={p.id} className={`pet-profile-card ${p.color}`}>
                    <div className="pet-card-top">
                      <span className="pet-card-species">
                        {p.species === 'dog'
                          ? th
                            ? 'สุนัข'
                            : 'Dog'
                          : p.species === 'cat'
                            ? th
                              ? 'แมว'
                              : 'Cat'
                            : th
                              ? 'เพื่อนตัวน้อย'
                              : 'Little friend'}
                      </span>
                      <span className="pet-card-controls">
                        {!p.archived && (
                          <button
                            aria-label={th ? `แก้ไข ${p.name}` : `Edit ${p.name}`}
                            onClick={() => {
                              setEditing(p);
                              setModal('pet');
                            }}
                          >
                            <Pencil size={16} />
                          </button>
                        )}
                        <button
                          disabled={pending === p.id}
                          aria-label={
                            p.archived
                              ? th
                                ? `นำ ${p.name} กลับมา`
                                : `Restore ${p.name}`
                              : th
                                ? `เก็บ ${p.name} เข้าคลัง`
                                : `Archive ${p.name}`
                          }
                          onClick={() => void archive(p)}
                        >
                          {p.archived ? <RotateCcw size={16} /> : <Archive size={16} />}
                        </button>
                      </span>
                    </div>
                    <div className="pet-avatar">
                      <Image src={photo(p)} alt="" width={110} height={110} />
                      <span>
                        <Heart size={15} fill="currentColor" />
                      </span>
                    </div>
                    <h3>
                      {p.name}{' '}
                      <small>{p.sex === 'male' ? '♂' : p.sex === 'female' ? '♀' : ''}</small>
                    </h3>
                    <p className="pet-breed">
                      {p.breed || (th ? 'เพื่อนตัวโปรดของครอบครัว' : 'A much-loved family member')}
                    </p>
                    <div className="pet-card-details">
                      <span>
                        <strong>{p.weight ?? '—'}</strong> kg
                      </span>
                      <span>
                        <PawPrint size={15} />
                        {p.birthday
                          ? dateLabel(p.birthday, locale)
                          : th
                            ? 'สมาชิกคนสำคัญ'
                            : 'Family member'}
                      </span>
                    </div>
                    {p.notes && <p className="pet-card-note">{p.notes}</p>}
                    <p className="pet-photo-note">{th ? 'ภาพประกอบ' : 'Illustration photo'}</p>
                  </article>
                ))}
                {!archived && (
                  <button
                    className="pet-add-card"
                    onClick={() => {
                      setEditing(undefined);
                      setModal('pet');
                    }}
                  >
                    <span>
                      <Plus size={25} />
                    </span>
                    <strong>{th ? 'อีกหนึ่งความรัก' : 'Room for a little more love'}</strong>
                    <p>
                      {th ? 'เพิ่มเพื่อนตัวโปรดเข้าครอบครัว' : 'Add a little friend to your family'}
                    </p>
                  </button>
                )}
              </div>
              {view === 'pets' && shown.length === 0 && (
                <p className="pet-empty-text">
                  {th
                    ? archived
                      ? 'ยังไม่มีโปรไฟล์ในคลัง'
                      : 'ยังไม่มีโปรไฟล์ที่ตรงกับการค้นหา'
                    : 'No pet profiles to show.'}
                </p>
              )}
            </section>
          )}
          {active.length > 0 && (view === 'overview' || view === 'health') && (
            <div className="pet-two-column">
              <section className="pet-panel">
                <div className="pet-section-heading">
                  <div>
                    <p className="eyebrow">GROWING WITH LOVE</p>
                    <h2>{th ? 'การเติบโตของน้อง' : 'Growing together'}</h2>
                  </div>
                  <Weight size={22} />
                </div>
                {petSelector}
                <WeightChart pet={current} locale={locale} />
                <Button variant="secondary" onClick={() => setModal('record')}>
                  <Plus size={16} />
                  {th ? 'เพิ่มบันทึกสุขภาพ' : 'Add health record'}
                </Button>
              </section>
              <section className="pet-panel">
                <div className="pet-section-heading">
                  <div>
                    <p className="eyebrow">A LITTLE REMINDER</p>
                    <h2>{th ? 'วันสำคัญที่กำลังจะมาถึง' : 'Little reminders'}</h2>
                  </div>
                  <Heart size={22} />
                </div>
                {upcoming.length ? (
                  upcoming.slice(0, 4).map((r) => (
                    <div key={r.id} className="pet-reminder">
                      <span className="pet-round-icon peach">
                        <Heart size={18} />
                      </span>
                      <div>
                        <strong>{r.title}</strong>
                        <p>
                          {r.petName} · {dateLabel(r.dueDate, locale)}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="pet-chart-empty">
                    <Sparkles size={30} />
                    <strong>{th ? 'วันนี้สบายใจได้' : 'A little peace of mind'}</strong>
                    <p>
                      {th
                        ? 'เพิ่มวันติดตามในสมุดสุขภาพ แล้วกลับมาดูได้ที่นี่'
                        : 'Add a follow-up date in the health journal to see it here.'}
                    </p>
                  </div>
                )}
              </section>
            </div>
          )}
          {view === 'health' && (
            <section className="pet-panel">
              <div className="pet-section-heading">
                <div>
                  <p className="eyebrow">HEALTH MEMORIES</p>
                  <h2>{th ? 'ประวัติสุขภาพ' : 'Health history'}</h2>
                </div>
              </div>
              {active.length > 0 && (
                <label className="pet-filter-label">
                  {th ? 'ประวัติของ' : 'History for'}
                  <Select value={current?.id ?? ''} onChange={(e) => setSelected(e.target.value)}>
                    {active.map((p) => (
                      <option value={p.id} key={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </Select>
                </label>
              )}
              {current?.records.length ? (
                current.records.map((r) => (
                  <RecordRow key={r.id} record={r} petName={current.name} locale={locale} />
                ))
              ) : (
                <div className="pet-chart-empty">
                  <FileText size={30} />
                  <strong>
                    {th ? 'เริ่มเก็บเรื่องราวสุขภาพของน้อง' : 'Start your pet’s health story'}
                  </strong>
                  <p>
                    {th
                      ? 'บันทึกตรวจสุขภาพ วัคซีน น้ำหนัก หรือโน้ตที่อยากเก็บไว้'
                      : 'Keep checkups, vaccines, weight, and little notes together.'}
                  </p>
                </div>
              )}
            </section>
          )}
          {(view === 'care' || (view === 'overview' && active.length > 0)) && (
            <section className="pet-panel pet-daily-panel">
              <div className="pet-section-heading">
                <div>
                  <p className="eyebrow">EVERY DAY MATTERS</p>
                  <h2>{th ? 'การดูแลเล็ก ๆ ในวันนี้' : 'Today’s little acts of care'}</h2>
                  <p className="pet-subtle">
                    {th
                      ? 'เช็กลิสต์พื้นฐาน 3 รายการต่อวัน · เปลี่ยนวันตามเวลาไทย'
                      : '3 everyday tasks · a fresh checklist each day in Bangkok time'}
                  </p>
                </div>
                <ClipboardCheck size={24} />
              </div>
              {active.length ? (
                careList(view === 'overview' ? active.slice(0, 2) : active)
              ) : (
                <p className="pet-empty-text">
                  {th
                    ? 'เพิ่มสัตว์เลี้ยงเพื่อเริ่มเช็กลิสต์ประจำวัน'
                    : 'Add a pet to start their daily checklist.'}
                </p>
              )}
            </section>
          )}
          {active.length === 0 && view !== 'pets' && view !== 'overview' && (
            <div className="pet-start-note">
              <PawPrint size={24} />
              <p>
                {th
                  ? 'เริ่มจากเพิ่มสัตว์เลี้ยง แล้วเก็บเรื่องราวของน้องไปด้วยกัน'
                  : 'Add your first pet to start keeping their little stories.'}
              </p>
              <Button
                onClick={() => {
                  setEditing(undefined);
                  setModal('pet');
                }}
              >
                {th ? 'เพิ่มสัตว์เลี้ยง' : 'Add a pet'}
              </Button>
            </div>
          )}
          <footer className="pet-workspace-footer">
            LITTLE PAWS. BIG LOVE. <Heart size={13} /> PetHub
          </footer>
        </main>
        {modal === 'pet' && <PetForm pet={editing} locale={locale} close={() => setModal(null)} />}
        {modal === 'record' && active.length > 0 && (
          <RecordForm
            pets={active}
            petId={current?.id ?? active[0]!.id}
            locale={locale}
            close={() => setModal(null)}
          />
        )}
      </div>
    </>
  );
}
