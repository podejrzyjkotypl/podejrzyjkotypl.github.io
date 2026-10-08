/*
 * podejrzyjkota: konfiguracja kont (Supabase). Instrukcja: js/config.example.js i README
 * („Konta i logowanie (Supabase)”).
 * Puste wartości = TRYB GOŚCIA: gra działa jak dotąd, bez logowania, postęp w localStorage.
 * Wklej tu WYŁĄCZNIE klucz anon/public (publishable). Nigdy service_role / secret.
 */
window.PODEJRZYJKOTA_CONFIG = {
  supabaseUrl: "https://hlinnwyepdjnlzyalmhn.supabase.co",
  supabaseAnonKey: "sb_publishable_vkYV_UL5Ppb2iybee0X2LA_jzxXOfa3",
  // google: wylaczone, dopoki nie ma klienta OAuth w Google Cloud (README, krok 5).
  // magicLink: wylaczone, dopoki nie ma wlasnego SMTP (wbudowana poczta Supabase wysyla tylko do zespolu, 2 maile/h).
  auth: { google: false, magicLink: false, password: true }
};
