import type { DateFormat } from "../types";

const thaiMonths = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
];

/** Formats an ISO date in an explicitly selected locale/style. Thai dates use Buddhist Era. */
export function formatCertificationDate(isoDate: string, format: DateFormat): string {
  const date = new Date(`${isoDate.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(date.getTime())) return "";
  const day = date.getDate();
  const month = date.getMonth();
  const year = date.getFullYear();
  switch (format) {
    case "thai-numeric":
      return `${String(day).padStart(2, "0")}/${String(month + 1).padStart(2, "0")}/${year + 543}`;
    case "thai-long":
      return `${day} ${thaiMonths[month]} ${year + 543}`;
    case "english-long":
      return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric" }).format(date);
    case "iso":
      return isoDate.slice(0, 10);
  }
}

export function todayIsoDate(): string {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}
