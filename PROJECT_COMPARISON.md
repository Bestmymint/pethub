# เปรียบเทียบ PawMap กับ PawSpace และแนวทางรวมโปรเจกต์

ตรวจโค้ดวันที่ 25 ตุลาคม 2026

- **PawMap ในเครื่อง:** `devtools/`, commit `255ca78` และ working tree ปัจจุบัน มี `next-env.d.ts` เปลี่ยนอยู่ก่อนการตรวจ
- **PawSpace บน GitHub:** `Bestmymint/Dev-tool`, branch `main`, commit `f06c418c67070a062628bd804df8b6e2b3f01799`
- เข้าถึง repository ส่วนตัวผ่าน GitHub CLI และอ่านสำเนาในโฟลเดอร์ชั่วคราว ไม่เปลี่ยน remote, source, database หรือ environment ของ PawMap
- เป็นการประเมินจาก source, schema, UI markup/CSS และ tests ที่มีอยู่ ยังไม่ได้รัน build/tests ของ PawSpace หรือทดลองรวมทั้งสองระบบ ผล PASS ในเอกสารของ PawSpace เป็นผลที่ repository บันทึกไว้ ไม่ใช่ผลทดสอบใหม่จากการตรวจนี้

## ข้อเสนอหลัก

รวมได้มากในระดับหน้าตาและฟีเจอร์ โดยใช้ **PawMap เป็นฐาน** และย้ายส่วนของ PawSpace มาเป็นโมดูลที่ใช้ PostgreSQL/Prisma กับ Better Auth เดิม

ทั้งสองเป็น Next.js App Router + React + TypeScript เหมือนกัน แต่เป็นคนละแอป: PawMap ช่วยค้นหาสถานที่และทำกิจกรรมร่วมกัน ส่วน PawSpace ช่วยดูแลสัตว์เลี้ยงและจัดคิวคลินิก จึงเสริมกันได้ดี แต่การรวม backend ต้องเขียนส่วนเชื่อมใหม่ ไม่สามารถคัดลอกทั้ง repository แล้วใช้งานร่วมกันได้ทันที

## ฟีเจอร์ที่เหมือนและต่าง

| ฟีเจอร์                                | PawMap ในเครื่อง                                                             | PawSpace บน GitHub                                                                                 |
| -------------------------------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| สมัครสมาชิก / ล็อกอิน / ออกจากระบบ     | มี Better Auth, สิทธิ์ USER/ADMIN                                            | มี session ที่เขียนเอง, สิทธิ์ user/admin                                                          |
| โปรไฟล์ผู้ใช้                          | เปลี่ยนชื่อและภาษาที่ใช้                                                     | เปลี่ยนชื่อและรหัสผ่านจากหน้าตั้งค่า                                                               |
| ลืมรหัสผ่าน                            | มี flow ส่งลิงก์ผ่าน SMTP ต้องตั้งบริการ                                     | README ระบุว่ายังไม่มี                                                                             |
| หน้า Admin / สถิติ / Audit             | ดูแลสถานที่ การส่งข้อมูล รีวิว รายงาน ผู้ใช้ Meetup และ import               | ดูแลสมาชิก สัตว์เลี้ยง ประวัติสุขภาพ และนัดหมาย                                                    |
| แจ้งเตือนในเว็บ                        | มี Notification ในฐานข้อมูล อ่านแล้ว/ยังไม่อ่าน และแจ้งเตือนกิจกรรม          | คำนวณรายการเตือนจากข้อมูลใน workspace เช่น วันติดตาม/นัดหมาย ไม่ได้ใช้ Notification model เดียวกัน |
| ค้นหา / กรอง                           | สถานที่ จังหวัด อำเภอ ประเภท และเงื่อนไขสัตว์เลี้ยง                          | สัตว์เลี้ยง นัดหมาย และบันทึกใน workspace                                                          |
| Responsive UI                          | มีหน้า desktop/mobile และชุด E2E                                             | มี Sidebar/mobile navigation และชุด E2E                                                            |
| แผนที่ไทย 3D / แผนที่ถนน               | มี Three.js GLB และ MapLibre/OSM                                             | ไม่พบ implementation                                                                               |
| ฐานข้อมูลสถานที่                       | snapshot 3,091 แห่ง, 77 จังหวัด, 926 อำเภอ, 16 หมวดหมู่                      | ไม่พบระบบสถานที่ลักษณะนี้                                                                          |
| รีวิว / Favorites / รายงานสถานที่      | มี รวม favorite collections และ community verification                       | ไม่พบ implementation                                                                               |
| ส่งสถานที่ / ตรวจอนุมัติ / Import      | มี                                                                           | ไม่พบ implementation                                                                               |
| Meetup / ขอเข้าร่วม / แชต / moderation | มี                                                                           | ไม่พบ implementation                                                                               |
| รายชื่อโรงพยาบาลสัตว์ฉุกเฉิน           | มีหน้าค้นหารายชื่อจากข้อมูลสถานที่                                           | ไม่พบ implementation                                                                               |
| โปรไฟล์สัตว์เลี้ยง                     | ไม่มี Pet model สำหรับสัตว์ของผู้ใช้; PetRule เป็นกฎเข้าสถานที่              | มีเพิ่ม/แก้/เก็บเข้าคลัง ชื่อ ชนิด สายพันธุ์ เพศ วันเกิด น้ำหนัก และโน้ต                           |
| สมุดสุขภาพ                             | ไม่พบโมดูลนี้                                                                | มีบันทึกตรวจสุขภาพ วัคซีน น้ำหนัก โน้ต และวันติดตาม                                                |
| กราฟน้ำหนัก                            | ไม่พบโมดูลนี้                                                                | มีกราฟ SVG จากประวัติจริง แสดงสูงสุด 8 รายการล่าสุด                                                |
| กิจวัตรประจำวัน                        | ไม่พบโมดูลนี้                                                                | กิจวัตรพื้นฐาน 3 รายการต่อสัตว์เลี้ยง บันทึกผลแยกตามวันเวลาไทย                                     |
| จองคิวคลินิก                           | ไม่พบโมดูลนี้; Meetup เป็นการนัดทำกิจกรรมคนละระบบ                            | มี wizard 3 ขั้น จองล่วงหน้าภายใน 30 วัน ยืนยัน/ปิดงาน/ยกเลิก                                      |
| ดาวน์โหลดข้อมูลผู้ใช้                  | ไม่พบปุ่ม export ข้อมูลสุขภาพใน UI; มีเครื่องมือ export สถานที่สำหรับผู้ดูแล | ดาวน์โหลด JSON ของสัตว์เลี้ยง นัดหมาย และบันทึกจาก workspace                                       |
| สถานะระบบ                              | readiness/liveness endpoints                                                 | health endpoint และหน้า Admin แสดง DB latency, memory, uptime, active sessions                     |
| รูปภาพ                                 | รองรับการเก็บ/อ่านรูปผ่าน S3-compatible storage                              | รูปสัตว์เป็นภาพประกอบ bundled ยังไม่มีระบบอัปโหลดรูปสัตว์เลี้ยง                                    |
| ภาษา                                   | มีหน้าไทยและอังกฤษ                                                           | UI ภาษาไทย มีข้อความอังกฤษประกอบ แต่ไม่พบชุดเส้นทางภาษาอังกฤษแบบ PawMap                            |
| Docker / Jenkins / Tests               | มี configuration และ test suites                                             | มี configuration และ test suites; เอกสารระบุว่ายังไม่ได้ทดสอบ Docker/Jenkins จริงในรอบที่บันทึก    |

คำว่า “มี” หมายถึงพบ implementation ใน source ไม่ได้ยืนยันว่าทุก flow ผ่านการทดสอบ runtime ในเครื่องปัจจุบัน

## ส่วน UI ที่เหมาะจะนำมาใช้

| ส่วนจาก PawSpace   | นำมาใช้กับ PawMap อย่างไร                                        | งานที่ต้องปรับ                                                                                    |
| ------------------ | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Landing page       | ใช้ hero รูปสัตว์เลี้ยง การ์ดฟีเจอร์ สีครีม/เขียว/พาสเทล และ CTA | ปรับข้อความ/ลิงก์ให้เข้ากับแผนที่และฟีเจอร์ที่มีจริง รักษาการเข้าถึง `/explore` และภาษาไทย/อังกฤษ |
| Sidebar workspace  | ทำหน้าส่วนตัว เช่น สัตว์เลี้ยง สุขภาพ Favorites และ Meetup       | เชื่อม Better Auth, เมนูจริง, active route และ mobile navigation                                  |
| Dashboard cards    | แสดงข้อมูลส่วนตัว/สถานที่/Meetup หรือโมดูลสัตว์เลี้ยงใหม่        | เปลี่ยนแหล่งข้อมูลจาก Snapshot ของ SQLite เป็น query ของ PawMap                                   |
| Dialog และแบบฟอร์ม | ใช้รูปแบบหน้าตา/ขั้นตอนของ PetForm, RecordForm และ BookingForm   | แยก component และต่อ mutation/validation ใหม่                                                     |
| กราฟน้ำหนัก        | ย้ายเป็น component ที่รับข้อมูลผ่าน props                        | ต้องมี Pet และ HealthRecord ก่อน; ไม่ต้องเพิ่มบริการกราฟภายนอก                                    |
| Admin system page  | เพิ่ม metrics และหน้าสถานะที่อ่านง่าย                            | เปลี่ยน query SQLite เป็น Prisma และใช้สิทธิ์ ADMIN ของ PawMap                                    |

จุดอ้างอิงหลักของ PawSpace:

- [Landing page](https://github.com/Bestmymint/Dev-tool/blob/f06c418c67070a062628bd804df8b6e2b3f01799/app/page.tsx)
- [Workspace / Sidebar / Dashboard / กราฟ / Metrics UI](https://github.com/Bestmymint/Dev-tool/blob/f06c418c67070a062628bd804df8b6e2b3f01799/components/workspace.tsx)
- [Dialog และ wizard](https://github.com/Bestmymint/Dev-tool/blob/f06c418c67070a062628bd804df8b6e2b3f01799/components/dialogs.tsx)
- [Global CSS](https://github.com/Bestmymint/Dev-tool/blob/f06c418c67070a062628bd804df8b6e2b3f01799/app/globals.css)

## เหตุผลที่ต้องย้ายเป็นส่วน ๆ

1. **Database ต่างกัน:** PawMap ใช้ PostgreSQL/Prisma ส่วน PawSpace ใช้ synchronous `node:sqlite`, SQL ตรง และ `BEGIN IMMEDIATE` ต้องเพิ่ม Prisma models/migrations และเขียน query ใหม่ โดยรักษา validation, ownership, consistency และกติกาการจองเดิม
2. **บัญชีและ session ต่างกัน:** PawSpace ใช้ `pawspace_session`, password hash ของตัวเอง และ role ตัวพิมพ์เล็ก ต้องให้หน้าใหม่ใช้ Better Auth/session/USER/ADMIN ของ PawMap หากต้องย้ายบัญชีจริงต้องออกแบบการจับคู่ผู้ใช้และการย้ายรหัสผ่านแยกต่างหาก ห้ามสมมติว่า session สองระบบใช้ร่วมกันได้
3. **App Router และชื่อไฟล์ซ้ำ:** PawMap ใช้ `src/app` แต่ PawSpace ใช้ `app` ที่ root และทั้งคู่มี `/`, `/login`, `/register`, `/admin`, `lib/auth.ts` และไฟล์ config ชื่อเดียวกัน การเพิ่ม root `app` ต้องระวังการเลือก app directory ของ Next.js ควรย้ายหน้าที่ต้องการเข้า `src/app` เดิม และจัด route ใหม่ชัดเจน
4. **API ต้องปรับ:** PawSpace รวม endpoints ใน `app/api/[...path]/route.ts` ขณะที่ PawMap มี route เฉพาะและ Better Auth ที่ `/api/auth/[...all]` ควรสร้าง endpoints ของโมดูลใหม่อย่างชัดเจน เช่น `/api/pets`, `/api/health-records`, `/api/appointments` หรือใช้ server actions ตามรูปแบบเดิม ไม่คัดลอก catch-all มาเป็นอีก backend โดยไม่จัดเส้นทาง
5. **CSS กระทบทั้งแอป:** PawSpace มี global CSS ประมาณ 5,680 บรรทัด รวม selectors ระดับ `body`, `button`, `h1`, `img` และตัวแปรร่วม เช่น `--muted`, `--paper`, `--font` ส่วน PawMap ใช้ Tailwind กับ token เดิม ควรแยก CSS Modules หรือแปลง style เฉพาะส่วน เพื่อให้หน้าแผนที่และฟอร์มเดิมยังแสดงถูกต้อง
6. **Dependencies ต่างรุ่น:** PawMap กำหนด Next 16.3.8, React 19.2.8, lucide-react 0.544.0 ส่วน PawSpace ประกาศ Next ^16.3.5, React ^19.3.0, lucide-react ^1.47.0 ต้องตรวจ imports/icons และเลือก dependency ชุดเดียว ไม่ทับ `package.json` หรือ lockfile ทั้งไฟล์ ทั้งสองใช้ Node 24 เป็นฐานร่วมได้ตาม engine ที่ประกาศ
7. **Workspace ผูกหลายเรื่องใน component เดียว:** `components/workspace.tsx` ของ PawSpace ยาวประมาณ 1,714 บรรทัด มี data fetching, auth calls, pet/health/booking/settings/admin UI รวมกัน ควรแยก layout/cards/forms/charts ออกจากส่วน SQLite และ session ก่อนนำมาใช้
8. **Booking ยังเป็นคลินิกเดียว:** schema ของ PawSpace ไม่มี clinic ID หรือ provider ID และ unique slot ใช้ร่วมทั้งระบบ การให้จองโรงพยาบาลหลายแห่งของ PawMap ต้องเพิ่มคลินิก ผู้ให้บริการ เวลาทำการ ความจุต่อช่วงเวลา และสิทธิ์ผู้ดูแลคลินิก ข้อมูลสถานที่อย่างเดียวไม่ยืนยันว่าคลินิกนั้นเปิดรับจองผ่านเว็บ
9. **การกันจองซ้ำต้องออกแบบบน PostgreSQL:** ห้ามเปลี่ยนเพียง SQL syntax แล้วทิ้งกติกาเดิม ต้องมี constraint/transaction ที่รับประกันว่าคำขอสองรายการในคิวเดียวกันสำเร็จได้ตามความจุ และคืนคิวได้เมื่อยกเลิก
10. **ภาษาและการแจ้งเตือน:** หน้าใหม่ควรรับ locale ตาม PawMap และเลือกใช้ระบบ Notification เดิม สำหรับเตือนสุขภาพต้องกำหนดว่าจะสร้าง event เมื่อบันทึกข้อมูล เปิดหน้า หรือมีงานตามเวลา ไม่ถือว่าการแสดง reminder ใน PawSpace เป็นระบบส่งข้อความเบื้องหลังที่พร้อมแล้ว

## ระดับความยากและลำดับที่แนะนำ

| งาน                                   | ความยากโดยประมาณจาก source | ต้องมีอะไรพร้อมก่อน                                            |
| ------------------------------------- | -------------------------- | -------------------------------------------------------------- |
| ย้ายสไตล์ Landing / hero / การ์ด      | ต่ำ–กลาง                   | ตัดสินใจแบรนด์ เนื้อหา และแยก CSS                              |
| ย้าย Sidebar / Dashboard layout       | กลาง                       | route/menu และ session เดียว                                   |
| เพิ่มโปรไฟล์สัตว์เลี้ยง               | กลาง                       | Pet model + ownership + forms                                  |
| เพิ่มกิจวัตร                          | กลาง                       | Pet, task definitions, completion ต่อวันไทย                    |
| เพิ่มบันทึกสุขภาพและกราฟ              | กลาง                       | Pet, HealthRecord, validation และสิทธิ์                        |
| เพิ่มจองคิวคลินิกเดียวตามขอบเขตเดิม   | กลาง–สูง                   | Pet, booking state machine, transactional constraints          |
| เชื่อมจองหลายคลินิกบนแผนที่           | สูง                        | clinic/provider/schedule/capacity model และการจัดการสิทธิ์ใหม่ |
| ย้ายบัญชีและข้อมูลจริงจาก SQLite      | สูง ขึ้นกับข้อมูล          | identity mapping, migration, backups และ verification          |
| รวมสอง backend และระบบล็อกอินพร้อมกัน | สูง ไม่ใช่แนวทางที่แนะนำ   | ต้องดูแลสอง identity/database/permission models                |

ระดับเหล่านี้เป็นการประเมินเชิงเทคนิค ไม่ใช่เปอร์เซ็นต์สำเร็จหรือกำหนดเวลาที่วัดแล้ว

แผนที่แนะนำ:

1. **UI ก่อน:** เปลี่ยน Landing และ workspace layout เฉพาะหน้าที่เลือก โดยยังใช้ API, auth และฐานข้อมูล PawMap เดิม เป็นขอบเขตที่เห็นผลชัดและกระทบข้อมูลน้อยที่สุด
2. **สัตว์เลี้ยงของฉัน:** เพิ่ม `Pet` เชื่อม `User.id` เดิม เปิด `/pets` หรือ `/dashboard/pets` โดยไม่แทนโมดูลสถานที่/Meetup
3. **สุขภาพและกิจวัตร:** เพิ่ม HealthRecord, CareTask และ DailyCareLog; ใช้กราฟและรูปแบบฟอร์มจาก PawSpace และเชื่อม Notification ของ PawMap เท่าที่ตกลงขอบเขต
4. **นัดหมาย:** เริ่มจากคลินิกเดียวก่อนหากต้องการรักษาขอบเขตเดิม แล้วจึงออกแบบหลายคลินิกหากเป็นความต้องการจริง

โครงสร้างข้อมูลเริ่มต้นที่เป็นข้อเสนอ ไม่ใช่ schema ที่สร้างแล้ว:

```text
User เดิม
  └─ Pet
       ├─ HealthRecord
       ├─ CareTask ─ DailyCareLog
       └─ Appointment

Place เดิม ─ Clinic/BookingConfiguration ─ Appointment
             (เพิ่มเมื่อรองรับคลินิกที่เปิดรับจองจริง)
```

## สิ่งที่ควรตรวจเมื่อเริ่มนำมารวม

- UI-only: desktop/mobile, ไม่มี CSS กระทบ `/explore`, login, admin, ภาษาไทย/อังกฤษ และแผนที่ทั้งสองแบบ
- Pet/health/care: อ่านและแก้ได้เฉพาะเจ้าของตามสิทธิ์; บันทึกแล้วยังคงอยู่; ตรวจวันเกิด/วันที่/น้ำหนัก; เก็บผลกิจวัตรตามวันไทย
- Appointment: จองพร้อมกันแล้วไม่เกินความจุ; ยกเลิกคืนคิว; เปลี่ยนสถานะตามสิทธิ์; timezone; ไม่จองสัตว์ของคนอื่น
- Identity: หน้าใหม่ใช้บัญชี PawMap เดียว; ไม่สร้าง session/role ชุดที่สองโดยไม่ตั้งใจ
- รักษา CI และ source verification เดิม; ไม่นำ config/demo seed ของ PawSpace มาทับทั้งชุด

ประเด็น WebGL ที่พบก่อนหน้านี้อยู่ที่เบราว์เซอร์สร้างกราฟิก context ไม่ได้ การย้าย UI ของ PawSpace ไม่ได้แก้ WebGL โดยตัวมันเอง และควรแยกการตรวจส่วนนั้นออกจากการรวมฟีเจอร์

## หลักฐานด้าน implementation เพิ่มเติม

- PawMap schema: [devtools/prisma/schema.prisma](devtools/prisma/schema.prisma)
- PawMap auth: [devtools/src/lib/auth.ts](devtools/src/lib/auth.ts)
- PawMap map: [devtools/src/features/map/thailand-scene.ts](devtools/src/features/map/thailand-scene.ts)
- PawMap UI shell: [devtools/src/components/page-shell.tsx](devtools/src/components/page-shell.tsx)
- PawSpace SQL schema: [lib/db.ts](https://github.com/Bestmymint/Dev-tool/blob/f06c418c67070a062628bd804df8b6e2b3f01799/lib/db.ts)
- PawSpace business rules: [lib/domain.ts](https://github.com/Bestmymint/Dev-tool/blob/f06c418c67070a062628bd804df8b6e2b3f01799/lib/domain.ts)
- PawSpace auth: [lib/auth.ts](https://github.com/Bestmymint/Dev-tool/blob/f06c418c67070a062628bd804df8b6e2b3f01799/lib/auth.ts)
- PawSpace API: [route.ts](https://github.com/Bestmymint/Dev-tool/blob/f06c418c67070a062628bd804df8b6e2b3f01799/app/api/%5B...path%5D/route.ts)
- PawSpace test scope/results recorded by its author: [docs/VERIFICATION.md](https://github.com/Bestmymint/Dev-tool/blob/f06c418c67070a062628bd804df8b6e2b3f01799/docs/VERIFICATION.md)
