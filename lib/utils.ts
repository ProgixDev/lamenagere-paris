export const formatPrice = (amount: number, currency = "EUR"): string => {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

export const formatDate = (date: Date | string): string => {
  return new Intl.DateTimeFormat("fr-FR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(date));
};

export const relativeTime = (date: Date | string): string => {
  const now = new Date();
  const diff = now.getTime() - new Date(date).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "À l’instant";
  if (minutes < 60) return `${minutes}m`;
  if (hours < 24) return `${hours}h`;
  if (days < 7) return `${days}j`;
  return formatDate(date);
};

export const truncate = (text: string, length: number): string => {
  return text.length > length ? text.substring(0, length) + "…" : text;
};

export const getInitials = (firstName: string, lastName: string): string => {
  return (firstName.charAt(0) + lastName.charAt(0)).toUpperCase();
};

/** Initials from a single full-name string ("Marie Curie" → "MC"). */
export const getNameInitials = (fullName: string): string => {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0].charAt(0);
  const last = parts.length > 1 ? parts[parts.length - 1].charAt(0) : "";
  return (first + last).toUpperCase();
};

export const formatDimensions = (
  width: number,
  height: number,
  depth?: number,
): string => {
  if (depth) {
    return `${width} cm × ${height} cm × ${depth} cm`;
  }
  return `${width} cm × ${height} cm`;
};

export const isValidPostalCode = (code: string): boolean => {
  return /^(0[1-9]|[1-8][0-9]|9[0-5]|97[0-6])\d{3}$/.test(code);
};

export const formatPhone = (phone: string): string => {
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length === 10) {
    return `${cleaned.slice(0, 2)} ${cleaned.slice(2, 4)} ${cleaned.slice(4, 6)} ${cleaned.slice(6, 8)} ${cleaned.slice(8)}`;
  }
  return phone;
};

export const isOverseas = (territory: string): boolean => {
  return ["reunion", "guadeloupe", "martinique", "guyane", "mayotte"].includes(
    territory,
  );
};
