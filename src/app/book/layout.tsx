import { BookThemeBody } from "@/components/booking/BookThemeBody";
import { BOOK_THEME_CLASSES } from "@/components/booking/theme";

export default function BookLayout({ children }: LayoutProps<"/book">) {
  return (
    <div className={`${BOOK_THEME_CLASSES.join(" ")} flex min-h-screen flex-1 flex-col bg-surface-muted text-neutral-900`}>
      <BookThemeBody classes={BOOK_THEME_CLASSES} />
      {children}
    </div>
  );
}
