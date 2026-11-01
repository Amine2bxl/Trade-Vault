//! TradeVault pour ordinateur.
//!
//! L'application ouvre TradeVault hébergé (https://tradevault.be) dans une
//! fenêtre native : même compte, mêmes données, toujours la dernière version —
//! aucune mise à jour à installer pour suivre le produit. Le site dépend de
//! ses fonctions serveur (Supabase, Stripe, Jarvis) : il ne peut pas tourner
//! hors ligne depuis un paquet statique.

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("TradeVault n'a pas pu démarrer");
}
