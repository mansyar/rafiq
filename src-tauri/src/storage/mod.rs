//! SQLite storage: schema migrations + key/value settings.

mod db;
mod settings;

pub use db::{init_db, schema_version, SCHEMA_VERSION};
pub use settings::SettingsRepo;
