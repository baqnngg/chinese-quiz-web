import "./globals.css";

export const metadata = {
  title: "中文 Quiz — 중국어 단어 연습",
  description: "중국어 1~7과 단어 퀴즈",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
