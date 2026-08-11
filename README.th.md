![EasySamnao icon](src/assets/easysamnao-icon.png)

# EasySamnao

[English](README.md) | ไทย

<!-- Thai translation of README.md. Keep major sections synchronized with the canonical English README. -->

> เอกสารนี้เป็นคำแปลภาษาไทยของ README.md ฉบับภาษาอังกฤษซึ่งเป็นเอกสารหลัก หากเนื้อหาระหว่างคำแปลมีความแตกต่างกัน ให้ยึด README.md เป็นหลัก

EasySamnao เป็นยูทิลิตีเดสก์ท็อป Windows ที่ทำงานภายในเครื่องเท่านั้น สำหรับเพิ่ม overlay การรับรองเอกสารภาษาไทยที่แก้ไขได้ลงในเอกสาร PDF และ PNG ออกแบบมาสำหรับเอกสารระบุตัวตนที่มีความละเอียดอ่อน: ไม่มี backend, cloud sync, analytics, telemetry, CDN หรือ runtime network dependency

## ภาพหน้าจอ

<img width="2560" height="1392" alt="Screenshot 2026-08-11 110224" src="https://github.com/user-attachments/assets/9925bff4-0e29-45f6-9b04-b20473804474" />

## คุณสมบัติ

- นำเข้า PDF และ PNG ผ่าน native file dialog หรือ drag and drop
- แสดงหน้า PDF ด้วย PDF.js และ render thumbnail ของหน้าแบบ lazy เท่านั้น
- มีเทมเพลตที่แก้ไขได้ ได้แก่ Classic Horizontal, Compact และ Minimal Diagonal
- ใช้โมเดลตำแหน่ง ขนาดความกว้าง และการหมุนแบบ normalized ร่วมกันระหว่าง preview และ export
- รองรับการลาก ปรับขนาดแบบคงสัดส่วน การหมุน การ snap และ guide ที่จุดกึ่งกลาง การปรับด้วยแป้นพิมพ์ และ undo/redo
- รองรับ layout ลายน้ำแยกตามแต่ละหน้า และการคัดลอก layout ไปยังหน้าที่เลือกหรือทุกหน้า
- รองรับวันที่พุทธศักราชไทย: `10/08/2569` และ `10 สิงหาคม 2569` รวมถึงรูปแบบภาษาอังกฤษและ ISO
- นำเข้า ทำความสะอาด แสดงตัวอย่าง เปลี่ยนชื่อ และจัดเก็บ SVG signature ภายในเครื่อง
- export PDF โดยไม่ rasterize เนื้อหา PDF ต้นฉบับ: ข้อความและเส้นจะวาดเป็น PDF vector และมีเพียง SVG signature ที่อาจถูก rasterize
- export PNG หนึ่งไฟล์ต่อหน้าที่ค่าเทียบเท่า 150, 300 หรือ 600 DPI
- ฝังฟอนต์ไทย TTF/OTF ที่ผู้ใช้เลือกลงใน PDF output ด้วย `pdf-lib` และ `fontkit`

## สถาปัตยกรรม

desktop shell ใช้ Tauri 2 + Rust ส่วน UI ใช้ React, TypeScript, Vite, Fluent UI, Zustand, PDF.js และ React Konva เลือกใช้ Tauri เพราะมี native footprint ขนาดเล็ก ใช้ Windows API ฝั่ง Rust และมีสถาปัตยกรรมที่ทำงานภายในเครื่องโดยไม่มี Electron/Node backend

โฟลเดอร์หลัก:

| โฟลเดอร์ | หน้าที่ |
| --- | --- |
| `src/pages` | หน้าจอ Create Copy และ Settings |
| `src/state` | Zustand settings, document, watermark history/state |
| `src/templates` | นิยามเทมเพลตและ element plan ที่ไม่ขึ้นกับแพลตฟอร์ม |
| `src/editor` | Konva group editor ที่แปลงขนาดและหมุนได้ |
| `src/documents` | ตรรกะการนำเข้าด้วย native และการ render ด้วย PDF.js |
| `src/export` | การ export PDF แบบ vector และ PNG ความละเอียดสูง |
| `src/signatures` | SVG sanitation และ storage bridge ฝั่ง browser |
| `src-tauri/src` | คำสั่งภายในเครื่อง การตรวจฟอนต์ และ DPAPI storage |

template plan คือรายการบรรทัด ข้อความ และ signature box ที่แก้ไขได้ โดย render ด้วย Konva สำหรับ preview, Canvas สำหรับ PNG export และ pdf-lib สำหรับ PDF export และจะไม่ถูกจัดเก็บเป็นภาพลายน้ำแบบ flattened

## โมเดล preview และพิกัด

pipeline ของ document preview คือ:

`original PDF → PDF.js canvas → transparent React Konva overlay`

`WatermarkTransform` ใช้สัดส่วนของหน้า (`x`, `y` และ `width`) ร่วมกับการหมุนของ editor โดย `x`/`y` ระบุจุดกึ่งกลางของ group การแปลงอย่างชัดเจนใน `src/utils/coordinates.ts` จะกลับแกน Y จาก browser แบบ top-left ไปเป็น PDF แบบ bottom-left และกลับทิศทางการหมุน ดังนั้น zoom, device pixel ratio, source resolution และ PNG DPI จะไม่เปลี่ยนตำแหน่งสุดท้าย

## การ export PDF และ PNG

สำหรับ PDF ต้นฉบับ `pdf-lib` จะโหลด bytes เดิมและเพิ่ม drawing commands ลงในแต่ละหน้า โดยไม่มีการจับภาพหน้าจอหรือ rasterize เอกสาร ฟอนต์ไทยที่เลือกจะถูกฝังด้วย `fontkit`; ข้อความและเส้นแนวนอนยังคงเป็น vector ส่วน SVG ที่ผ่านการ sanitize เป็น source data โดย implementation จะ rasterize เฉพาะ signature เป็น PNG โปร่งใสความละเอียดสูงเพื่อความเข้ากันได้กับ PDF

PNG export จะ render หน้า PDF ต้นฉบับด้วย PDF.js ที่ DPI ที่เลือก แล้ว compositing template plan เดียวกัน หน้าหลายหน้าจะถูกบันทึกเป็น `filename-easysamnao-page-001.png` เป็นต้น โดยจะไม่สร้าง PNG หลายหน้า

## ลายเซ็น ฟอนต์ และความเป็นส่วนตัว

SVG ที่นำเข้าจะผ่าน sanitizer สำหรับกราฟิกเท่านั้น ซึ่งคงไว้เฉพาะ tag/attribute ของ shape ที่ปลอดภัย และลบ scripts, event handlers, `foreignObject`, images, external resources, JavaScript/file URLs, `<use>` และ element ที่ไม่รู้จักทั้งหมด payload ที่ผ่านการ sanitize จะถูกเข้ารหัสด้วย Windows DPAPI ก่อนเขียนลงใต้ standard per-user Tauri application-data directory ส่วน metadata และ settings ยังคงเป็น local JSON ปกติ bytes ของ signature จะถูกถอดรหัสไว้ใน process memory เฉพาะตอน preview/export เท่านั้น

แอปจะตรวจสอบ TTF/OTF ที่เลือกว่ามี Thai glyphs ที่จำเป็นสำหรับเทมเพลตหรือไม่ โดยจะค้นหา TH Sarabun New ใน `C:\Windows\Fonts` เมื่อเปิดใช้งานครั้งแรก หากไม่พบ ให้เลือกฟอนต์ในเครื่องอื่นที่รองรับภาษาไทยใน Settings ฟอนต์จะไม่ถูกดาวน์โหลดในขณะ runtime

UI ของแอปบันเดิล Manrope และ Noto Sans Thai ภายใต้ SIL Open Font License 1.1 โดยมี license notice อยู่ที่ `src/assets/Manrope-OFL.txt` และ `src/assets/NotoSansThai-OFL.txt`

capability file อนุญาตเฉพาะสิทธิ์สำหรับ core window, native dialog และ explicit opener การอ่าน/เขียนไฟล์ทำผ่าน Rust commands ที่รับเฉพาะ extension ของเอกสาร ฟอนต์ และ signature ที่คาดไว้ CSP ปฏิเสธ `connect-src` ดังนั้น UI จึงไม่สามารถส่ง network request ได้

## ใบอนุญาต

EasySamnao เป็น source-available ไม่ใช่ OSI open source ภายใต้ [PolyForm Noncommercial License 1.0.0](LICENSE) การใช้งานอยู่ภายใต้ [LICENSE.md](LICENSE.md) ซึ่งเป็นข้อความทางกฎหมายที่ใช้บังคับ และสามารถดูได้จาก [PolyForm Project](https://polyformproject.org/licenses/noncommercial/1.0.0) การใช้งานเชิงพาณิชย์ไม่ได้รับอนุญาต และปัจจุบันไม่มี commercial license แยกต่างหาก ดู [ข้อมูลการใช้งานเชิงพาณิชย์](COMMERCIAL-USE.md)

## การตั้งค่าสำหรับพัฒนา

ข้อกำหนดเบื้องต้นบน Windows:

- Node.js 20+ (โปรเจกต์นี้สร้างด้วย Node 22)
- Rust stable พร้อม MSVC toolchain (`rustup toolchain install stable-x86_64-pc-windows-msvc`)
- Microsoft C++ Build Tools และ WebView2 Runtime ตามที่ Tauri ต้องใช้

```powershell
npm install
npm run dev
```

สำหรับ desktop application:

```powershell
npm run tauri dev
```

## การทดสอบ

```powershell
npm run test
cargo test --manifest-path src-tauri/Cargo.toml
```

ชุดทดสอบ Vitest ครอบคลุมการแปลงพิกัด/การหมุน วันที่ภาษาไทย การประกอบและค่าเริ่มต้นของเทมเพลต การตัดบรรทัด การแปลงค่าสี การคัดลอก layout เฉพาะหน้า undo/redo กฎของ SVG sanitizer และ PDF output แบบ vector ที่ทดสอบด้วยโปรแกรม ส่วนการทดสอบ Rust ครอบคลุม storage identifier ที่ปลอดภัย file extension ที่คาดไว้ และการเข้ารหัส/ถอดรหัส DPAPI

## ตัวติดตั้งสำหรับใช้งานจริง

```powershell
npm run tauri build
```

Tauri สร้างตัวติดตั้งไว้ใต้ `src-tauri\target\release\bundle\nsis\` และ `src-tauri\target\release\bundle\msi\` (Wix/MSI) ขึ้นอยู่กับ Windows bundle tools ที่ติดตั้งอยู่ NSIS target ถูกตั้งค่าให้ติดตั้งต่อผู้ใช้หนึ่งราย และไม่ต้องการสิทธิ์ผู้ดูแลระบบ

## ข้อจำกัดที่ทราบ

- ต้องมีฟอนต์ TTF/OTF ในเครื่องที่รองรับภาษาไทยก่อน export PDF เพื่อป้องกัน output ภาษาไทยที่ไม่ถูกต้องจากฟอนต์ PDF ในตัวที่ไม่รองรับภาษาไทย
- SVG ถูกจำกัดไว้เฉพาะ primitive graphics ที่ปลอดภัย โดยจะลบ complex filters, fonts, embedded images และ external references
- การเก็บรักษา PDF page annotation/form มอบให้ pdf-lib จัดการ ซึ่งอาจมีข้อจำกัดสำหรับ source PDF ที่เข้ารหัส มีรูปแบบผิดปกติ หรือ interactive อย่างมาก ส่วน PDF ที่ป้องกันด้วยรหัสผ่านจะถูกปฏิเสธพร้อมข้อความที่ชัดเจน
