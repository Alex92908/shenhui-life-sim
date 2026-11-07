// Text moderation for anything one player writes that other players see:
// nicknames, chat and the shared feed. Masks profanity, links and contact
// handles (phone / QQ / WeChat numbers — the usual spam and scam vector).
// The word list is deliberately short and extensible; add to BAD_WORDS as
// reports come in.

const BAD_WORDS = [
  // zh
  "傻逼", "煞笔", "傻b", "沙比", "sb", "操你", "草你", "肏", "日你", "你妈", "尼玛", "nmsl", "妈的", "他妈", "去死", "滚蛋",
  "贱人", "婊子", "狗日", "王八蛋", "白痴", "脑残", "智障", "废物", "垃圾人",
  // en
  "fuck", "fucking", "shit", "bitch", "asshole", "bastard", "dick", "cunt", "nigger", "nigga", "retard", "slut", "whore",
];
const esc = (w: string) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// Latin words only match as whole words (so "Dickens" or "class" survive).
const BAD_RE = new RegExp(BAD_WORDS.map((w) => (/^[a-z]+$/i.test(w) ? `\\b${esc(w)}\\b` : esc(w))).join("|"), "gi");
const URL_RE = /(https?:\/\/\S+|www\.\S+|\b[\w-]+\.(com|cn|net|org|io|top|xyz|cc|me|vip)\b\S*)/gi;
const CONTACT_RE = /(微信|威信|薇信|vx|wx|v信|qq|扣扣|tg|telegram|whatsapp)[\s:：号]*[a-z0-9_-]{4,}/gi;
const DIGITS_RE = /\d[\d\s-]{6,}\d/g;

/** Mask what other players should not see; keeps the rest of the text. */
export function cleanText(input: string): string {
  return input
    .replace(URL_RE, "[链接已隐藏]")
    .replace(CONTACT_RE, "[联系方式已隐藏]")
    .replace(DIGITS_RE, "＊＊＊")
    .replace(BAD_RE, (m) => "＊".repeat(Math.min(4, [...m].length)));
}

/** A nickname: cleaned, and never empty after cleaning. */
export function cleanName(input: string): string {
  const out = cleanText(input.trim()).replace(/\[[^\]]*\]/g, "").trim();
  return out.length > 0 ? out.slice(0, 12) : "深漂玩家";
}
