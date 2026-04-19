export const KOREA_COUNTRY_NAME = "대한민국";

export const KOREA_MAJOR_CITIES = [
"강원특별자치도",
  "경기도",
  "경상남도",
  "경상북도",
  "광주광역시",
  "대구광역시",
  "대전광역시",
  "부산광역시",
  "서울특별시",
  "세종특별자치시",
  "울산광역시",
  "인천광역시",
  "전라남도",
  "전북특별자치도",
  "제주특별자치도",
  "충청남도",
  "충청북도"
] as const;

export function normalizeKoreaCity(value: string | null | undefined): string {
  if (!value) {
    return "";
  }

  return KOREA_MAJOR_CITIES.includes(
    value as (typeof KOREA_MAJOR_CITIES)[number],
  )
    ? value
    : "";
}
