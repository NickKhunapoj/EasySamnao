import type { AppLanguage } from "../types";

export const translations = {
  en: {
    createCopy: "Create Copy", settings: "Settings", properties: "Properties", pages: "Pages",
    localUtility: "Local-only document utility", importDocument: "Import document", import: "Import", discard: "Discard", discardConfirm: "Discard the current document and all unsaved watermark changes?",
    exportCompleted: "Export completed.", openFile: "Open file", openFolder: "Open folder",
    previewZoom: "Preview zoom", fitPage: "Fit page", fitWidth: "Fit width", currentPage: "Current page", selectedPages: "Selected pages", allPages: "All pages",
    exportPdf: "Export PDF", exportPng: "Export PNG", exportPages: "Pages to export", exportPage: "Export", watermarkPage: "Watermark", pngResolution: "PNG export resolution",
    include: "Include", template: "Template", certificationTemplate: "Certification template", purpose: "Purpose", certificationText: "Certification text",
    purposeHint: "Type the complete phrase, e.g. ใช้สมัครงาน … เท่านั้น", purposeExact: "Text is used exactly as entered.",
    signature: "Signature", electronicSignature: "Electronic signature", noSignature: "No signature", signerName: "Signer name", showSignerName: "Show signer name", showDate: "Show date", date: "Date", dateFormat: "Date format",
    appearance: "Appearance", textColor: "Text color", lineColor: "Line color", opacity: "Opacity", layout: "Layout", rotation: "Rotation", width: "Width", scale: "Scale", resetLayout: "Reset layout", applyToWatermarked: "Apply to watermarked pages",
    importDocumentToView: "Import a document to view pages.", importDocumentToEdit: "Import a document to edit its certification watermark.",
    importPdfOrPng: "Import a PDF or PNG", dropDocument: "Drag a document here, or select it from your computer. Files stay on this device.", chooseDocument: "Choose document",
    defaults: "Defaults", language: "Language", theme: "Theme", light: "Light", dark: "Dark", system: "System", defaultTemplate: "Default template", defaultOpacity: "Default opacity", defaultRotation: "Default rotation", defaultDateFormat: "Default date format",
    signatureLibrary: "Signature library", addSignature: "Add signature", noSignatures: "No signatures yet. Imported SVGs are sanitized and encrypted with Windows DPAPI.", rename: "Rename", delete: "Delete", setDefault: "Set as default", default: "Default",
    thaiFont: "Thai font", bundledFont: "TH Sarabun New is bundled and embedded automatically in every PDF export. Choose another local font only when you want an override.", currentFont: "Current font", embedded: "TH Sarabun New (embedded)", overrideFont: "Override with TTF/OTF",
    settingsDescription: "Defaults and local signature library", savedSignature: "Signature saved securely on this device.", selectedFont: "Thai font selected. It will be embedded in future PDF exports.",
    classicHorizontal: "Classic Horizontal", compact: "Compact", minimalDiagonal: "Minimal Diagonal"
  },
  th: {
    createCopy: "สร้างสำเนารับรอง", settings: "ตั้งค่า", properties: "คุณสมบัติ", pages: "หน้า",
    localUtility: "เครื่องมือรับรองเอกสารที่ทำงานบนอุปกรณ์นี้เท่านั้น", importDocument: "นำเข้าเอกสาร", import: "นำเข้า", discard: "ยกเลิก", discardConfirm: "ยกเลิกเอกสารปัจจุบันและการแก้ไขลายน้ำที่ยังไม่บันทึกทั้งหมดใช่หรือไม่?",
    exportCompleted: "ส่งออกเสร็จสมบูรณ์", openFile: "เปิดไฟล์", openFolder: "เปิดโฟลเดอร์",
    previewZoom: "การซูมตัวอย่าง", fitPage: "พอดีกับหน้า", fitWidth: "พอดีกับความกว้าง", currentPage: "หน้าปัจจุบัน", selectedPages: "หน้าที่เลือก", allPages: "ทุกหน้า",
    exportPdf: "ส่งออก PDF", exportPng: "ส่งออก PNG", pngPages: "หน้าสำหรับ PNG", pngResolution: "ความละเอียด PNG",
    include: "ใส่ใน", template: "รูปแบบ", certificationTemplate: "รูปแบบคำรับรอง", purpose: "วัตถุประสงค์", certificationText: "ข้อความรับรอง",
    purposeHint: "พิมพ์ข้อความทั้งหมด เช่น ใช้สมัครงาน … เท่านั้น", purposeExact: "ใช้ข้อความตามที่พิมพ์ทุกประการ",
    signature: "ลายมือชื่อ", electronicSignature: "ลายมือชื่ออิเล็กทรอนิกส์", noSignature: "ไม่มีลายมือชื่อ", signerName: "ชื่อผู้ลงนาม", showSignerName: "แสดงชื่อผู้ลงนาม", showDate: "แสดงวันที่", date: "วันที่", dateFormat: "รูปแบบวันที่",
    appearance: "ลักษณะ", textColor: "สีข้อความ", lineColor: "สีเส้น", opacity: "ความทึบ", layout: "ตำแหน่ง", rotation: "การหมุน", width: "ความกว้าง", scale: "ขนาด", resetLayout: "รีเซ็ตตำแหน่ง", applyToIncluded: "ใช้กับหน้าที่เลือก",
    importDocumentToView: "นำเข้าเอกสารเพื่อดูหน้า", importDocumentToEdit: "นำเข้าเอกสารเพื่อแก้ไขลายน้ำรับรอง",
    importPdfOrPng: "นำเข้า PDF หรือ PNG", dropDocument: "ลากเอกสารมาวางที่นี่ หรือเลือกจากคอมพิวเตอร์ของคุณ ไฟล์จะอยู่บนอุปกรณ์นี้เท่านั้น", chooseDocument: "เลือกเอกสาร",
    defaults: "ค่าเริ่มต้น", language: "ภาษา", theme: "ธีม", light: "สว่าง", dark: "มืด", system: "ตามระบบ", defaultTemplate: "รูปแบบเริ่มต้น", defaultOpacity: "ความทึบเริ่มต้น", defaultRotation: "การหมุนเริ่มต้น", defaultDateFormat: "รูปแบบวันที่เริ่มต้น",
    signatureLibrary: "คลังลายมือชื่อ", addSignature: "เพิ่มลายมือชื่อ", noSignatures: "ยังไม่มีลายมือชื่อ ไฟล์ SVG ที่นำเข้าจะถูกกรองและเข้ารหัสด้วย Windows DPAPI", rename: "เปลี่ยนชื่อ", delete: "ลบ", setDefault: "ตั้งเป็นค่าเริ่มต้น", default: "ค่าเริ่มต้น",
    thaiFont: "แบบอักษรไทย", bundledFont: "TH Sarabun New ถูกรวมไว้และฝังในทุกไฟล์ PDF โดยอัตโนมัติ เลือกแบบอักษรในเครื่องเฉพาะเมื่อต้องการแทนที่", currentFont: "แบบอักษรปัจจุบัน", embedded: "TH Sarabun New (รวมในโปรแกรม)", overrideFont: "แทนที่ด้วย TTF/OTF",
    settingsDescription: "ค่าเริ่มต้นและคลังลายมือชื่อในเครื่อง", savedSignature: "บันทึกลายมือชื่ออย่างปลอดภัยบนอุปกรณ์นี้แล้ว", selectedFont: "เลือกแบบอักษรไทยแล้ว ระบบจะฝังใน PDF ที่ส่งออกครั้งต่อไป",
    classicHorizontal: "แนวนอนแบบคลาสสิก", compact: "แบบกะทัดรัด", minimalDiagonal: "แนวทแยงแบบเรียบง่าย"
  }
} as const;

export function text(language: AppLanguage) { return { ...translations.en, ...translations[language] }; }
