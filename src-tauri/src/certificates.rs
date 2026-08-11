use crate::{signatures, storage::{app_directory, read_json, safe_signature_id, write_json}};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{fs, mem::{size_of, zeroed}, path::{Path, PathBuf}, ptr, time::{SystemTime, UNIX_EPOCH}};
use tauri::AppHandle;
use zeroize::Zeroize;

#[cfg(target_os = "windows")]
use windows_sys::Win32::{
    Foundation::BOOL,
    Security::Cryptography::*,
};

const MAX_PKCS12_BYTES: u64 = 20 * 1024 * 1024;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum CertificateStatus {
    Active,
    Expiring,
    Expired,
    Retired,
    Compromised,
    Revoked,
    MissingPrivateKey,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum CertificateTrust { SelfSigned, Trusted, Untrusted, Unknown }

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BoundSignature {
    pub svg_id: String,
    pub svg_sha256: String,
    pub bound_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CertificateProfile {
    pub id: String,
    pub display_name: String,
    pub source: String,
    pub certificate_fingerprint: String,
    pub subject: String,
    pub issuer: String,
    pub serial_number: String,
    pub valid_from: String,
    pub valid_until: String,
    pub trust: CertificateTrust,
    pub status: CertificateStatus,
    pub private_key_reference: Option<String>,
    pub bound_signature: Option<BoundSignature>,
    pub predecessor_certificate_id: Option<String>,
    pub successor_certificate_id: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BindingState {
    pub state: String,
    pub svg_id: Option<String>,
    pub expected_sha256: Option<String>,
    pub actual_sha256: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PdfSignatureVerification {
    pub integrity_valid: bool,
    pub document_changed_after_signing: bool,
    pub signer: Option<String>,
    pub certificate_fingerprint: Option<String>,
    pub trust: CertificateTrust,
    pub certificate_status: CertificateStatus,
    pub message: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateCertificateRequest {
    pub id: String,
    pub display_name: String,
    pub subject_name: String,
    pub email: Option<String>,
    pub organization: Option<String>,
    pub validity_years: u32,
    pub bind_svg_id: Option<String>,
    pub predecessor_certificate_id: Option<String>,
}

fn profiles_path(app: &AppHandle) -> Result<PathBuf, String> { Ok(app_directory(app)?.join("certificate-profiles.json")) }
fn now_stamp() -> String { SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_secs().to_string() }
fn certificate_id_ok(id: &str) -> bool { safe_signature_id(id) && id.starts_with("certificate-") }

fn read_profiles(app: &AppHandle) -> Result<Vec<CertificateProfile>, String> { Ok(read_json(&profiles_path(app)?)?.unwrap_or_default()) }
fn write_profiles(app: &AppHandle, profiles: &[CertificateProfile]) -> Result<(), String> { write_json(&profiles_path(app)?, profiles) }

pub fn svg_sha256(svg: &str) -> String {
    let hash = Sha256::digest(svg.as_bytes());
    hex(&hash)
}

fn hex(bytes: &[u8]) -> String { bytes.iter().map(|byte| format!("{byte:02X}")).collect() }

fn unix_to_iso(seconds: i64) -> String {
    // Howard Hinnant's civil-date conversion; this only formats a public timestamp.
    let days = seconds.div_euclid(86_400);
    let seconds_of_day = seconds.rem_euclid(86_400);
    let z = days + 719_468;
    let era = if z >= 0 { z } else { z - 146_096 } / 146_097;
    let doe = z - era * 146_097;
    let yoe = (doe - doe / 1_460 + doe / 36_524 - doe / 146_096) / 365;
    let mut year = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let day = doy - (153 * mp + 2) / 5 + 1;
    let month = mp + if mp < 10 { 3 } else { -9 };
    year += if month <= 2 { 1 } else { 0 };
    format!("{year:04}-{month:02}-{day:02}T{:02}:{:02}:{:02}Z", seconds_of_day / 3_600, (seconds_of_day % 3_600) / 60, seconds_of_day % 60)
}

fn filetime_to_iso(low: u32, high: u32) -> String {
    let ticks = ((high as u64) << 32) | low as u64;
    let unix_seconds = ticks.saturating_sub(116_444_736_000_000_000) / 10_000_000;
    unix_to_iso(unix_seconds as i64)
}

fn is_expired(valid_until: &str) -> bool {
    let now = unix_to_iso(SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_secs() as i64);
    valid_until <= now.as_str()
}

fn expires_soon(valid_until: &str) -> bool {
    let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_secs() as i64;
    let text = unix_to_iso(now + 30 * 86_400);
    valid_until <= text.as_str()
}

#[cfg(target_os = "windows")]
fn last_error(operation: &str) -> String { format!("{operation}: {}", std::io::Error::last_os_error()) }

#[cfg(target_os = "windows")]
fn wide(value: &str) -> Vec<u16> { value.encode_utf16().chain(Some(0)).collect() }

#[cfg(target_os = "windows")]
unsafe fn certificate_property(context: *const CERT_CONTEXT, property: u32) -> Option<Vec<u8>> {
    let mut length = 0u32;
    if CertGetCertificateContextProperty(context, property, ptr::null_mut(), &mut length) == 0 || length == 0 { return None; }
    let mut bytes = vec![0u8; length as usize];
    if CertGetCertificateContextProperty(context, property, bytes.as_mut_ptr().cast(), &mut length) == 0 { return None; }
    bytes.truncate(length as usize);
    Some(bytes)
}

#[cfg(target_os = "windows")]
unsafe fn name_from_blob(blob: *const CRYPT_INTEGER_BLOB) -> String {
    let encoding = X509_ASN_ENCODING | PKCS_7_ASN_ENCODING;
    let needed = CertNameToStrW(encoding, blob, CERT_X500_NAME_STR, ptr::null_mut(), 0);
    if needed == 0 { return "Unknown".to_string(); }
    let mut output = vec![0u16; needed as usize];
    if CertNameToStrW(encoding, blob, CERT_X500_NAME_STR, output.as_mut_ptr(), needed) == 0 { return "Unknown".to_string(); }
    String::from_utf16_lossy(&output[..output.len().saturating_sub(1)])
}

#[cfg(target_os = "windows")]
unsafe fn has_private_key(context: *const CERT_CONTEXT) -> bool {
    let mut handle: HCRYPTPROV_OR_NCRYPT_KEY_HANDLE = 0;
    let mut key_spec: CERT_KEY_SPEC = 0;
    let mut caller_must_free: BOOL = 0;
    let acquired = CryptAcquireCertificatePrivateKey(context, CRYPT_ACQUIRE_SILENT_FLAG | CRYPT_ACQUIRE_ALLOW_NCRYPT_KEY_FLAG, ptr::null(), &mut handle, &mut key_spec, &mut caller_must_free);
    if acquired == 0 { return false; }
    if caller_must_free != 0 {
        if key_spec == CERT_NCRYPT_KEY_SPEC { let _ = NCryptFreeObject(handle); }
        else { let _ = CryptReleaseContext(handle, 0); }
    }
    true
}

#[cfg(target_os = "windows")]
unsafe fn chain_trust(context: *const CERT_CONTEXT) -> CertificateTrust {
    match chain_error_status(context) {
        None => CertificateTrust::Unknown,
        Some(status) if status == 0 => CertificateTrust::Trusted,
        Some(status) if status & CERT_TRUST_IS_UNTRUSTED_ROOT != 0 => CertificateTrust::SelfSigned,
        Some(status) if status & CERT_TRUST_IS_REVOKED != 0 => CertificateTrust::Untrusted,
        Some(_) => CertificateTrust::Unknown,
    }
}

#[cfg(target_os = "windows")]
unsafe fn chain_error_status(context: *const CERT_CONTEXT) -> Option<u32> {
    let mut chain: *mut CERT_CHAIN_CONTEXT = ptr::null_mut();
    let mut para: CERT_CHAIN_PARA = zeroed();
    para.cbSize = size_of::<CERT_CHAIN_PARA>() as u32;
    if CertGetCertificateChain(0, context, ptr::null(), ptr::null_mut(), &para, CERT_CHAIN_REVOCATION_CHECK_CHAIN_EXCLUDE_ROOT, ptr::null(), &mut chain) == 0 || chain.is_null() {
        return None;
    }
    let status = (*chain).TrustStatus.dwErrorStatus;
    CertFreeCertificateChain(chain);
    Some(status)
}

#[cfg(target_os = "windows")]
unsafe fn inspect_context(context: *const CERT_CONTEXT, source: &str, display_name: Option<String>) -> CertificateProfile {
    let cert = &*context;
    let info = &*cert.pCertInfo;
    let fingerprint = certificate_property(context, CERT_SHA256_HASH_PROP_ID).map(|value| hex(&value)).unwrap_or_default();
    let subject = name_from_blob(&info.Subject);
    let issuer = name_from_blob(&info.Issuer);
    let serial = std::slice::from_raw_parts(info.SerialNumber.pbData, info.SerialNumber.cbData as usize);
    let valid_from = filetime_to_iso(info.NotBefore.dwLowDateTime, info.NotBefore.dwHighDateTime);
    let valid_until = filetime_to_iso(info.NotAfter.dwLowDateTime, info.NotAfter.dwHighDateTime);
    let key_available = has_private_key(context);
    let trust = if subject == issuer { CertificateTrust::SelfSigned } else { chain_trust(context) };
    let chain_revoked = subject != issuer && chain_error_status(context).is_some_and(|errors| errors & CERT_TRUST_IS_REVOKED != 0);
    let status = if chain_revoked { CertificateStatus::Revoked }
        else if !key_available { CertificateStatus::MissingPrivateKey }
        else if is_expired(&valid_until) { CertificateStatus::Expired }
        else if expires_soon(&valid_until) { CertificateStatus::Expiring }
        else { CertificateStatus::Active };
    let now = now_stamp();
    CertificateProfile {
        id: String::new(),
        display_name: display_name.unwrap_or_else(|| subject.clone()),
        source: source.to_string(),
        certificate_fingerprint: fingerprint.clone(),
        subject,
        issuer,
        serial_number: hex(serial),
        valid_from,
        valid_until,
        trust,
        status,
        private_key_reference: key_available.then_some(format!("windows-store:{fingerprint}")),
        bound_signature: None,
        predecessor_certificate_id: None,
        successor_certificate_id: None,
        created_at: now.clone(),
        updated_at: now,
    }
}

#[cfg(target_os = "windows")]
unsafe fn open_personal_store() -> Result<HCERTSTORE, String> {
    let name = wide("MY");
    let store = CertOpenSystemStoreW(0, name.as_ptr());
    if store.is_null() { Err(last_error("Unable to open the Windows personal certificate store")) } else { Ok(store) }
}

#[cfg(target_os = "windows")]
unsafe fn find_by_fingerprint(store: HCERTSTORE, fingerprint: &str) -> Result<*mut CERT_CONTEXT, String> {
    find_by_certificate_hash(store, fingerprint, CERT_SHA256_HASH_PROP_ID)
}

#[cfg(target_os = "windows")]
unsafe fn find_by_thumbprint(store: HCERTSTORE, thumbprint: &str) -> Result<*mut CERT_CONTEXT, String> {
    find_by_certificate_hash(store, thumbprint, CERT_HASH_PROP_ID)
}

#[cfg(target_os = "windows")]
unsafe fn find_by_certificate_hash(store: HCERTSTORE, fingerprint: &str, property: u32) -> Result<*mut CERT_CONTEXT, String> {
    let wanted = fingerprint.to_ascii_uppercase();
    let mut previous: *const CERT_CONTEXT = ptr::null();
    loop {
        let context = CertEnumCertificatesInStore(store, previous);
        if context.is_null() { return Err("The selected certificate is no longer available in the Windows certificate store.".to_string()); }
        previous = context;
        let actual = certificate_property(context, property).map(|value| hex(&value)).unwrap_or_default();
        if actual == wanted { return Ok(context); }
    }
}

#[cfg(target_os = "windows")]
fn power_shell_certificate(subject: &str, display_name: &str, validity_years: u32) -> Result<String, String> {
    // New-SelfSignedCertificate is Windows' CertEnroll-backed API. Values are passed in
    // per-process environment variables rather than interpolated into PowerShell source.
    let script = "$s=[Environment]::GetEnvironmentVariable('EASYSAMNAO_CERT_SUBJECT');$n=[Environment]::GetEnvironmentVariable('EASYSAMNAO_CERT_NAME');$y=[int][Environment]::GetEnvironmentVariable('EASYSAMNAO_CERT_YEARS');$c=New-SelfSignedCertificate -Type Custom -Subject $s -FriendlyName $n -CertStoreLocation 'Cert:\\CurrentUser\\My' -KeyAlgorithm RSA -KeyLength 3072 -HashAlgorithm SHA256 -KeyUsage DigitalSignature -KeyExportPolicy NonExportable -NotAfter (Get-Date).AddYears($y);[Console]::Out.Write($c.Thumbprint)";
    let output = std::process::Command::new("powershell.exe")
        .args(["-NoLogo", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script])
        .env("EASYSAMNAO_CERT_SUBJECT", subject)
        .env("EASYSAMNAO_CERT_NAME", display_name)
        .env("EASYSAMNAO_CERT_YEARS", validity_years.to_string())
        .output()
        .map_err(|error| format!("Unable to start the Windows certificate service: {error}"))?;
    if !output.status.success() { return Err("Windows could not create the certificate. Check that the Windows certificate service is available.".to_string()); }
    let fingerprint = String::from_utf8_lossy(&output.stdout).trim().to_ascii_uppercase();
    if fingerprint.len() != 40 || !fingerprint.chars().all(|character| character.is_ascii_hexdigit()) { return Err("Windows returned an invalid certificate fingerprint.".to_string()); }
    Ok(fingerprint)
}

#[cfg(target_os = "windows")]
pub fn create(app: &AppHandle, request: CreateCertificateRequest) -> Result<CertificateProfile, String> {
    if !certificate_id_ok(&request.id) || request.display_name.trim().is_empty() || request.subject_name.trim().is_empty() { return Err("A certificate name and your name are required.".to_string()); }
    if !(1..=10).contains(&request.validity_years) { return Err("Choose a certificate validity between 1 and 10 years.".to_string()); }
    let mut subject_parts = vec![format!("CN={}", request.subject_name.trim())];
    if let Some(organization) = request.organization.as_deref().filter(|value| !value.trim().is_empty()) { subject_parts.push(format!("O={}", organization.trim())); }
    if let Some(email) = request.email.as_deref().filter(|value| !value.trim().is_empty()) { subject_parts.push(format!("E={}", email.trim())); }
    let fingerprint = power_shell_certificate(&subject_parts.join(", "), request.display_name.trim(), request.validity_years)?;
    let store = unsafe { open_personal_store()? };
    // PowerShell exposes the conventional SHA-1 Thumbprint. We use it only to
    // locate the just-created certificate, then store the SHA-256 fingerprint.
    let context = unsafe { find_by_thumbprint(store, &fingerprint) };
    let mut profile = match context { Ok(context) => unsafe { let inspected = inspect_context(context, "generated", Some(request.display_name.trim().to_string())); CertFreeCertificateContext(context); inspected }, Err(error) => { unsafe { CertCloseStore(store, 0); } return Err(error); } };
    unsafe { CertCloseStore(store, 0); }
    profile.id = request.id;
    profile.predecessor_certificate_id = request.predecessor_certificate_id;
    profile.created_at = now_stamp(); profile.updated_at = profile.created_at.clone();
    let mut profiles = read_profiles(app)?;
    if profiles.iter().any(|item| item.id == profile.id || item.certificate_fingerprint == profile.certificate_fingerprint) { return Err("This certificate is already in EasySamnao.".to_string()); }
    if let Some(predecessor) = profile.predecessor_certificate_id.as_deref() {
        if let Some(previous) = profiles.iter_mut().find(|item| item.id == predecessor) { previous.successor_certificate_id = Some(profile.id.clone()); previous.updated_at = now_stamp(); }
    }
    profiles.push(profile.clone());
    write_profiles(app, &profiles)?;
    if let Some(svg_id) = request.bind_svg_id { bind_signature(app, &profile.id, &svg_id)?; return get_profile(app, &profile.id); }
    Ok(profile)
}

#[cfg(not(target_os = "windows"))]
pub fn create(_: &AppHandle, _: CreateCertificateRequest) -> Result<CertificateProfile, String> { Err("Digital certificates are currently available only on Windows.".to_string()) }

pub fn list(app: &AppHandle) -> Result<Vec<CertificateProfile>, String> {
    let mut profiles = read_profiles(app)?;
    #[cfg(target_os = "windows")]
    {
        let store = unsafe { open_personal_store()? };
        for profile in &mut profiles {
            match unsafe { find_by_fingerprint(store, &profile.certificate_fingerprint) } {
                Ok(context) => {
                    let inspected = unsafe { let inspected = inspect_context(context, &profile.source, Some(profile.display_name.clone())); CertFreeCertificateContext(context); inspected };
                    if !matches!(profile.status, CertificateStatus::Retired | CertificateStatus::Compromised | CertificateStatus::Revoked) { profile.status = inspected.status; }
                    profile.trust = inspected.trust;
                    profile.private_key_reference = inspected.private_key_reference;
                    profile.subject = inspected.subject; profile.issuer = inspected.issuer; profile.serial_number = inspected.serial_number;
                    profile.valid_from = inspected.valid_from; profile.valid_until = inspected.valid_until;
                }
                Err(_) => if !matches!(profile.status, CertificateStatus::Retired | CertificateStatus::Compromised | CertificateStatus::Revoked) { profile.status = CertificateStatus::MissingPrivateKey; }
            }
            profile.updated_at = now_stamp();
        }
        unsafe { CertCloseStore(store, 0); }
        write_profiles(app, &profiles)?;
    }
    Ok(profiles)
}

pub fn get_profile(app: &AppHandle, id: &str) -> Result<CertificateProfile, String> { list(app)?.into_iter().find(|item| item.id == id).ok_or_else(|| "Certificate not found.".to_string()) }

pub fn bind_signature(app: &AppHandle, certificate_id: &str, svg_id: &str) -> Result<(), String> {
    if !safe_signature_id(svg_id) { return Err("Invalid signature identifier.".to_string()); }
    let svg = signatures::load(app, svg_id)?;
    let hash = svg_sha256(&svg);
    let mut profiles = read_profiles(app)?;
    let profile = profiles.iter_mut().find(|item| item.id == certificate_id).ok_or("Certificate not found.")?;
    profile.bound_signature = Some(BoundSignature { svg_id: svg_id.to_string(), svg_sha256: hash, bound_at: now_stamp() });
    profile.updated_at = now_stamp();
    write_profiles(app, &profiles)
}

pub fn binding_state(app: &AppHandle, certificate_id: &str) -> Result<BindingState, String> {
    let profile = get_profile(app, certificate_id)?;
    let Some(binding) = profile.bound_signature else { return Ok(BindingState { state: "unbound".to_string(), svg_id: None, expected_sha256: None, actual_sha256: None }); };
    match signatures::load(app, &binding.svg_id) {
        Ok(svg) => {
            let actual = svg_sha256(&svg);
            Ok(BindingState { state: if actual == binding.svg_sha256 { "valid" } else { "changed" }.to_string(), svg_id: Some(binding.svg_id), expected_sha256: Some(binding.svg_sha256), actual_sha256: Some(actual) })
        }
        Err(_) => Ok(BindingState { state: "missing".to_string(), svg_id: Some(binding.svg_id), expected_sha256: Some(binding.svg_sha256), actual_sha256: None }),
    }
}

pub fn set_status(app: &AppHandle, certificate_id: &str, status: CertificateStatus) -> Result<(), String> {
    if !matches!(status, CertificateStatus::Retired | CertificateStatus::Compromised) { return Err("Only local retired or compromised states can be set manually.".to_string()); }
    let mut profiles = read_profiles(app)?;
    let profile = profiles.iter_mut().find(|item| item.id == certificate_id).ok_or("Certificate not found.")?;
    profile.status = status; profile.updated_at = now_stamp();
    write_profiles(app, &profiles)
}

#[cfg(target_os = "windows")]
fn read_pkcs12(path: &str) -> Result<Vec<u8>, String> {
    let metadata = fs::metadata(path).map_err(|error| format!("Unable to inspect the certificate file: {error}"))?;
    if metadata.len() == 0 || metadata.len() > MAX_PKCS12_BYTES { return Err("The P12/PFX file is empty or exceeds the 20 MB safety limit.".to_string()); }
    if !matches!(Path::new(path).extension().and_then(|value| value.to_str()).map(|value| value.to_ascii_lowercase()).as_deref(), Some("p12") | Some("pfx")) { return Err("Choose a .p12 or .pfx certificate file.".to_string()); }
    fs::read(path).map_err(|error| format!("Unable to read the certificate file: {error}"))
}

#[cfg(target_os = "windows")]
unsafe fn import_pfx_store(bytes: &[u8], password: &mut String, flags: CRYPT_KEY_FLAGS) -> Result<HCERTSTORE, String> {
    let blob = CRYPT_INTEGER_BLOB { cbData: bytes.len() as u32, pbData: bytes.as_ptr() as *mut u8 };
    if PFXIsPFXBlob(&blob) == 0 { password.zeroize(); return Err("The selected file is not a valid PKCS#12 (P12/PFX) container.".to_string()); }
    let mut password_wide = wide(password);
    let store = PFXImportCertStore(&blob, password_wide.as_ptr(), flags);
    password_wide.zeroize();
    password.zeroize();
    if store.is_null() { Err("The certificate could not be opened. The password may be incorrect or the P12/PFX file is damaged.".to_string()) } else { Ok(store) }
}

#[cfg(target_os = "windows")]
unsafe fn first_certificate(store: HCERTSTORE) -> Result<*mut CERT_CONTEXT, String> {
    let context = CertEnumCertificatesInStore(store, ptr::null());
    if context.is_null() { Err("The P12/PFX file contains no certificate.".to_string()) } else { Ok(context) }
}

#[cfg(target_os = "windows")]
pub fn inspect_pkcs12(path: String, mut password: String) -> Result<CertificateProfile, String> {
    let bytes = match read_pkcs12(&path) { Ok(bytes) => bytes, Err(error) => { password.zeroize(); return Err(error); } };
    let store = unsafe { import_pfx_store(&bytes, &mut password, 0)? };
    let context = unsafe { first_certificate(store) };
    let result = context.map(|context| unsafe { let inspected = inspect_context(context, "pkcs12", None); CertFreeCertificateContext(context); inspected });
    unsafe { CertCloseStore(store, 0); }
    result
}

#[cfg(target_os = "windows")]
pub fn import_pkcs12(app: &AppHandle, id: String, display_name: String, path: String, mut password: String) -> Result<CertificateProfile, String> {
    if !certificate_id_ok(&id) || display_name.trim().is_empty() { password.zeroize(); return Err("A certificate name is required.".to_string()); }
    let bytes = match read_pkcs12(&path) { Ok(bytes) => bytes, Err(error) => { password.zeroize(); return Err(error); } };
    let imported_store = unsafe { import_pfx_store(&bytes, &mut password, CRYPT_USER_KEYSET)? };
    let context = match unsafe { first_certificate(imported_store) } { Ok(context) => context, Err(error) => { unsafe { CertCloseStore(imported_store, 0); } return Err(error); } };
    let personal_store = match unsafe { open_personal_store() } { Ok(store) => store, Err(error) => { unsafe { CertFreeCertificateContext(context); CertCloseStore(imported_store, 0); } return Err(error); } };
    let added = unsafe { CertAddCertificateContextToStore(personal_store, context, CERT_STORE_ADD_USE_EXISTING, ptr::null_mut()) };
    if added == 0 { unsafe { CertFreeCertificateContext(context); CertCloseStore(imported_store, 0); CertCloseStore(personal_store, 0); } return Err(last_error("Unable to add the certificate to the Windows personal certificate store")); }
    let mut profile = unsafe { inspect_context(context, "pkcs12", Some(display_name.trim().to_string())) };
    unsafe { CertFreeCertificateContext(context); CertCloseStore(imported_store, 0); CertCloseStore(personal_store, 0); }
    profile.id = id; profile.created_at = now_stamp(); profile.updated_at = profile.created_at.clone();
    let mut profiles = read_profiles(app)?;
    if profiles.iter().any(|item| item.certificate_fingerprint == profile.certificate_fingerprint) { return Err("This certificate is already in EasySamnao.".to_string()); }
    profiles.push(profile.clone()); write_profiles(app, &profiles)?; Ok(profile)
}

#[cfg(not(target_os = "windows"))]
pub fn inspect_pkcs12(_: String, _: String) -> Result<CertificateProfile, String> { Err("P12/PFX certificates are currently available only on Windows.".to_string()) }
#[cfg(not(target_os = "windows"))]
pub fn import_pkcs12(_: &AppHandle, _: String, _: String, _: String, _: String) -> Result<CertificateProfile, String> { Err("P12/PFX certificates are currently available only on Windows.".to_string()) }

#[cfg(target_os = "windows")]
pub fn discover_windows(app: &AppHandle) -> Result<Vec<CertificateProfile>, String> {
    let store = unsafe { open_personal_store()? };
    let mut discovered = Vec::new(); let mut previous: *const CERT_CONTEXT = ptr::null();
    loop {
        let context = unsafe { CertEnumCertificatesInStore(store, previous) };
        if context.is_null() { break; }
        previous = context;
        let candidate = unsafe { inspect_context(context, "windows-store", None) };
        if candidate.private_key_reference.is_some() { discovered.push(candidate); }
    }
    unsafe { CertCloseStore(store, 0); }
    let mut profiles = read_profiles(app)?;
    for mut candidate in discovered {
        if profiles.iter().any(|item| item.certificate_fingerprint == candidate.certificate_fingerprint) { continue; }
        candidate.id = format!("certificate-windows-{}", candidate.certificate_fingerprint.to_ascii_lowercase());
        candidate.created_at = now_stamp(); candidate.updated_at = candidate.created_at.clone();
        profiles.push(candidate);
    }
    write_profiles(app, &profiles)?;
    Ok(profiles)
}

#[cfg(not(target_os = "windows"))]
pub fn discover_windows(_: &AppHandle) -> Result<Vec<CertificateProfile>, String> { Err("Windows certificate discovery is available only on Windows.".to_string()) }

#[cfg(target_os = "windows")]
pub fn export_certificate(app: &AppHandle, certificate_id: &str, path: &str) -> Result<(), String> {
    if Path::new(path).exists() { return Err("Refusing to overwrite an existing certificate file.".to_string()); }
    if !matches!(Path::new(path).extension().and_then(|value| value.to_str()).map(|value| value.to_ascii_lowercase()).as_deref(), Some("cer")) { return Err("Certificate-only export must use a .cer filename.".to_string()); }
    let profile = get_profile(app, certificate_id)?;
    let store = unsafe { open_personal_store()? };
    let context = unsafe { find_by_fingerprint(store, &profile.certificate_fingerprint) };
    let result = context.and_then(|context| {
        let cert = unsafe { &*context };
        let bytes = unsafe { std::slice::from_raw_parts(cert.pbCertEncoded, cert.cbCertEncoded as usize) };
        let written = fs::write(path, bytes).map_err(|error| format!("Unable to export the certificate: {error}"));
        unsafe { CertFreeCertificateContext(context); }
        written
    });
    unsafe { CertCloseStore(store, 0); }
    result
}

#[cfg(target_os = "windows")]
pub fn export_pkcs12(app: &AppHandle, certificate_id: &str, path: &str, mut password: String) -> Result<(), String> {
    if password.is_empty() { password.zeroize(); return Err("A non-empty password is required to export a private key.".to_string()); }
    if Path::new(path).exists() { password.zeroize(); return Err("Refusing to overwrite an existing P12/PFX file.".to_string()); }
    if !matches!(Path::new(path).extension().and_then(|value| value.to_str()).map(|value| value.to_ascii_lowercase()).as_deref(), Some("p12") | Some("pfx")) { password.zeroize(); return Err("Private-key export must use a .p12 or .pfx filename.".to_string()); }
    let profile = get_profile(app, certificate_id)?;
    let source_store = unsafe { open_personal_store()? };
    let context = unsafe { find_by_fingerprint(source_store, &profile.certificate_fingerprint) }?;
    let export_store = unsafe { CertOpenStore(CERT_STORE_PROV_MEMORY, 0, 0, 0, ptr::null()) };
    if export_store.is_null() { password.zeroize(); unsafe { CertFreeCertificateContext(context); CertCloseStore(source_store, 0); } return Err(last_error("Unable to prepare certificate export")); }
    let added = unsafe { CertAddCertificateContextToStore(export_store, context, CERT_STORE_ADD_ALWAYS, ptr::null_mut()) };
    if added == 0 { password.zeroize(); unsafe { CertFreeCertificateContext(context); CertCloseStore(export_store, 0); CertCloseStore(source_store, 0); } return Err(last_error("Unable to prepare certificate export")); }
    let mut password_wide = wide(&password);
    let mut blob = CRYPT_INTEGER_BLOB { cbData: 0, pbData: ptr::null_mut() };
    let flags = EXPORT_PRIVATE_KEYS | REPORT_NOT_ABLE_TO_EXPORT_PRIVATE_KEY;
    let sized = unsafe { PFXExportCertStoreEx(export_store, &mut blob, password_wide.as_ptr(), ptr::null(), flags) };
    if sized == 0 { password.zeroize(); password_wide.zeroize(); unsafe { CertFreeCertificateContext(context); CertCloseStore(export_store, 0); CertCloseStore(source_store, 0); } return Err("The Windows key provider does not permit this private key to be exported.".to_string()); }
    let mut output = vec![0u8; blob.cbData as usize]; blob.pbData = output.as_mut_ptr();
    let encoded = unsafe { PFXExportCertStoreEx(export_store, &mut blob, password_wide.as_ptr(), ptr::null(), flags) };
    password.zeroize();
    password_wide.zeroize();
    unsafe { CertFreeCertificateContext(context); CertCloseStore(export_store, 0); CertCloseStore(source_store, 0); }
    if encoded == 0 { return Err("The Windows key provider could not export this private key.".to_string()); }
    output.truncate(blob.cbData as usize);
    fs::write(path, output).map_err(|error| format!("Unable to write the P12/PFX export: {error}"))
}

#[cfg(not(target_os = "windows"))]
pub fn export_certificate(_: &AppHandle, _: &str, _: &str) -> Result<(), String> { Err("Certificate export is available only on Windows.".to_string()) }
#[cfg(not(target_os = "windows"))]
pub fn export_pkcs12(_: &AppHandle, _: &str, _: &str, _: String) -> Result<(), String> { Err("Certificate export is available only on Windows.".to_string()) }

pub fn remove_profile(app: &AppHandle, certificate_id: &str) -> Result<(), String> {
    let mut profiles = read_profiles(app)?;
    let before = profiles.len(); profiles.retain(|profile| profile.id != certificate_id);
    if profiles.len() == before { return Err("Certificate not found.".to_string()); }
    write_profiles(app, &profiles)
}

#[cfg(target_os = "windows")]
pub fn delete_from_windows(app: &AppHandle, certificate_id: &str, confirmation: &str) -> Result<(), String> {
    if confirmation != "DELETE CERTIFICATE" { return Err("Type DELETE CERTIFICATE to permanently delete the Windows certificate and private key.".to_string()); }
    let profile = get_profile(app, certificate_id)?;
    let store = unsafe { open_personal_store()? };
    let context = unsafe { find_by_fingerprint(store, &profile.certificate_fingerprint) }?;
    let thumbprint = unsafe { certificate_property(context, CERT_HASH_PROP_ID).map(|value| hex(&value)).ok_or("Windows did not provide a certificate thumbprint.")? };
    unsafe { CertFreeCertificateContext(context); CertCloseStore(store, 0); }
    // The Cert: provider owns both the certificate record and (when supported by its
    // provider) the private-key container. It is safer than deleting app metadata.
    let script = "$t=[Environment]::GetEnvironmentVariable('EASYSAMNAO_CERT_THUMBPRINT');Remove-Item -LiteralPath ('Cert:\\CurrentUser\\My\\'+$t) -DeleteKey -ErrorAction Stop";
    let output = std::process::Command::new("powershell.exe")
        .args(["-NoLogo", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script])
        .env("EASYSAMNAO_CERT_THUMBPRINT", thumbprint)
        .output()
        .map_err(|error| format!("Unable to start the Windows certificate service: {error}"))?;
    if !output.status.success() { return Err("Windows refused to delete this certificate or its private key. The EasySamnao profile was left unchanged.".to_string()); }
    remove_profile(app, certificate_id)
}

#[cfg(not(target_os = "windows"))]
pub fn delete_from_windows(_: &AppHandle, _: &str, _: &str) -> Result<(), String> { Err("Windows certificate deletion is available only on Windows.".to_string()) }

#[cfg(target_os = "windows")]
pub fn sign_pdf(app: &AppHandle, certificate_id: &str, mut pdf: Vec<u8>) -> Result<Vec<u8>, String> {
    let profile = get_profile(app, certificate_id)?;
    if matches!(profile.status, CertificateStatus::Expired | CertificateStatus::Retired | CertificateStatus::Compromised | CertificateStatus::Revoked | CertificateStatus::MissingPrivateKey) { return Err("The selected certificate cannot sign new documents in its current state.".to_string()); }
    if is_expired(&profile.valid_until) { return Err("The selected certificate has expired and cannot sign a new document.".to_string()); }
    let (range_start, range_end, contents_start, contents_end) = locate_placeholder(&pdf)?;
    let before = contents_start;
    let after = contents_end + 1;
    let byte_range = format!("/ByteRange [0 {before} {after} {}]", pdf.len() - after);
    let old_length = range_end - range_start;
    if byte_range.len() > old_length { return Err("PDF signature placeholder is too small for its byte range.".to_string()); }
    let mut padded = byte_range.into_bytes(); padded.extend(std::iter::repeat(b' ').take(old_length - padded.len()));
    pdf[range_start..range_end].copy_from_slice(&padded);
    let store = unsafe { open_personal_store()? };
    let context = unsafe { find_by_fingerprint(store, &profile.certificate_fingerprint) }?;
    let signed = unsafe { cms_detached(context, &pdf[..before], &pdf[after..]) };
    unsafe { CertFreeCertificateContext(context); CertCloseStore(store, 0); }
    let cms = signed?;
    let capacity = contents_end - contents_start - 1;
    if cms.len() * 2 > capacity { return Err("The certificate chain is larger than the reserved PDF signature field. Try signing again; EasySamnao will reserve a larger field in a future release.".to_string()); }
    // pdf-lib initializes this field with binary zeroes. Write conventional
    // hexadecimal zero padding before adding the detached CMS container.
    pdf[contents_start + 1..contents_end].fill(b'0');
    let encoded = hex(&cms);
    pdf[contents_start + 1..contents_start + 1 + encoded.len()].copy_from_slice(encoded.as_bytes());
    Ok(pdf)
}

#[cfg(target_os = "windows")]
fn include_signing_certificate(
    parameters: &mut CRYPT_SIGN_MESSAGE_PARA,
    message_certificates: &mut [*mut CERT_CONTEXT; 1],
    context: *const CERT_CONTEXT,
) {
    message_certificates[0] = context as *mut CERT_CONTEXT;
    parameters.cMsgCert = message_certificates.len() as u32;
    parameters.rgpMsgCert = message_certificates.as_mut_ptr();
}

#[cfg(target_os = "windows")]
unsafe fn cms_detached(context: *const CERT_CONTEXT, first: &[u8], second: &[u8]) -> Result<Vec<u8>, String> {
    let mut sha256_oid = b"2.16.840.1.101.3.4.2.1\0".to_vec();
    let algorithm = CRYPT_ALGORITHM_IDENTIFIER { pszObjId: sha256_oid.as_mut_ptr().cast(), Parameters: CRYPT_INTEGER_BLOB { cbData: 0, pbData: ptr::null_mut() } };
    let mut parameters: CRYPT_SIGN_MESSAGE_PARA = zeroed();
    parameters.cbSize = size_of::<CRYPT_SIGN_MESSAGE_PARA>() as u32;
    parameters.dwMsgEncodingType = X509_ASN_ENCODING | PKCS_7_ASN_ENCODING;
    parameters.pSigningCert = context;
    // `pSigningCert` authorizes CryptoAPI to use the private key, but it does
    // not embed that certificate in the CMS. PDF viewers need the signer
    // certificate in SignedData to parse and validate /Contents.
    let mut message_certificates = [ptr::null_mut()];
    include_signing_certificate(&mut parameters, &mut message_certificates, context);
    parameters.HashAlgorithm = algorithm;
    let data = [first.as_ptr(), second.as_ptr()]; let lengths = [first.len() as u32, second.len() as u32];
    let mut length = 0u32;
    if CryptSignMessage(&parameters, 1, 2, data.as_ptr(), lengths.as_ptr(), ptr::null_mut(), &mut length) == 0 { return Err(last_error("Windows could not create the CMS/PKCS#7 signature")); }
    let mut result = vec![0u8; length as usize];
    if CryptSignMessage(&parameters, 1, 2, data.as_ptr(), lengths.as_ptr(), result.as_mut_ptr(), &mut length) == 0 { return Err(last_error("Windows could not create the CMS/PKCS#7 signature")); }
    result.truncate(length as usize); Ok(result)
}

#[cfg(not(target_os = "windows"))]
pub fn sign_pdf(_: &AppHandle, _: &str, _: Vec<u8>) -> Result<Vec<u8>, String> { Err("PDF signing is available only on Windows.".to_string()) }

fn locate_placeholder(pdf: &[u8]) -> Result<(usize, usize, usize, usize), String> {
    let byte_range_marker = b"/ByteRange";
    let range_start = find_bytes(pdf, byte_range_marker).ok_or("This PDF is missing a prepared digital-signature field.")?;
    let mut range_open = range_start + byte_range_marker.len();
    while pdf.get(range_open).is_some_and(u8::is_ascii_whitespace) { range_open += 1; }
    if pdf.get(range_open) != Some(&b'[') { return Err("The PDF signature ByteRange is malformed.".to_string()); }
    let range_close = pdf[range_open..].iter().position(|byte| *byte == b']').map(|offset| range_open + offset).ok_or("The PDF signature ByteRange is malformed.")?;
    let compact = pdf[range_open + 1..range_close].iter().copied().filter(|byte| !byte.is_ascii_whitespace()).collect::<Vec<_>>();
    if compact.as_slice() != b"0/**********/**********/**********" { return Err("This PDF does not contain an unsigned EasySamnao signature placeholder.".to_string()); }
    let range_end = range_close + 1;
    let contents_marker = b"/Contents";
    let after_range = &pdf[range_end..];
    let contents_relative = find_bytes(after_range, contents_marker).ok_or("This PDF signature field does not contain a CMS placeholder.")?;
    let mut contents_start = range_end + contents_relative + contents_marker.len();
    while pdf.get(contents_start).is_some_and(u8::is_ascii_whitespace) { contents_start += 1; }
    if pdf.get(contents_start) != Some(&b'<') { return Err("This PDF signature field does not contain a CMS placeholder.".to_string()); }
    let contents_end = pdf[contents_start + 1..].iter().position(|byte| *byte == b'>').map(|offset| contents_start + 1 + offset).ok_or("The PDF signature placeholder is malformed.")?;
    if contents_end <= contents_start + 1 { return Err("The PDF signature placeholder is empty.".to_string()); }
    Ok((range_start, range_end, contents_start, contents_end))
}

fn find_bytes(haystack: &[u8], needle: &[u8]) -> Option<usize> { haystack.windows(needle.len()).position(|part| part == needle) }

#[cfg(target_os = "windows")]
pub fn verify_pdf(pdf: Vec<u8>) -> Result<Vec<PdfSignatureVerification>, String> {
    if pdf.len() > 200 * 1024 * 1024 { return Err("The PDF exceeds the 200 MB signature-verification safety limit.".to_string()); }
    let mut results = Vec::new(); let mut offset = 0;
    while let Some(relative) = find_bytes(&pdf[offset..], b"/ByteRange [") {
        let position = offset + relative;
        let end = pdf[position..].iter().position(|byte| *byte == b']').map(|value| position + value).ok_or("A PDF signature ByteRange is malformed.")?;
        let values = std::str::from_utf8(&pdf[position + b"/ByteRange [".len()..end]).map_err(|_| "A PDF signature ByteRange is not text.")?.split_whitespace().map(str::parse::<usize>).collect::<Result<Vec<_>, _>>().map_err(|_| "A PDF signature ByteRange contains invalid values.")?;
        if values.len() != 4 || values[0] != 0 || values[1] > pdf.len() || values[2] > pdf.len() || values[2].saturating_add(values[3]) > pdf.len() || values[1] >= values[2] { results.push(invalid_verification("Invalid PDF signature byte range.")); offset = end + 1; continue; }
        let cms_start = values[1]; let cms_end = values[2];
        let signature = if pdf.get(cms_start) == Some(&b'<') && pdf.get(cms_end.saturating_sub(1)) == Some(&b'>') { decode_cms_padded(&pdf[cms_start + 1..cms_end - 1], &pdf[..cms_start], &pdf[cms_end..cms_end + values[3]]) } else { None };
        results.push(match signature { Some((certificate, trust)) => {
            let signer = unsafe { name_from_blob(&(*certificate).pCertInfo.as_ref().unwrap().Subject) };
            let fingerprint = unsafe { certificate_property(certificate, CERT_SHA256_HASH_PROP_ID).map(|value| hex(&value)) };
            let until = unsafe { let info = &*(*certificate).pCertInfo; filetime_to_iso(info.NotAfter.dwLowDateTime, info.NotAfter.dwHighDateTime) };
            unsafe { CertFreeCertificateContext(certificate); }
            let changed = cms_end + values[3] < pdf.len();
            PdfSignatureVerification { integrity_valid: true, document_changed_after_signing: changed, signer: Some(signer), certificate_fingerprint: fingerprint, trust: trust.clone(), certificate_status: if is_expired(&until) { CertificateStatus::Expired } else { CertificateStatus::Active }, message: if changed { "Document integrity through this signature is valid; the PDF has later incremental changes.".to_string() } else if trust == CertificateTrust::SelfSigned { "Document integrity verified. The certificate is self-signed; signer identity has not been independently verified.".to_string() } else if trust == CertificateTrust::Trusted { "Document integrity verified and the certificate chain is trusted by Windows.".to_string() } else { "Document integrity verified, but signer trust is not established.".to_string() } }
        }, None => invalid_verification("The signature is invalid or the signed PDF content was modified."), });
        offset = end + 1;
    }
    Ok(results)
}

#[cfg(target_os = "windows")]
fn decode_cms_padded(hex_data: &[u8], first: &[u8], second: &[u8]) -> Option<(*mut CERT_CONTEXT, CertificateTrust)> {
    let text = std::str::from_utf8(hex_data).ok()?.trim();
    if text.len() % 2 != 0 || !text.as_bytes().iter().all(|byte| byte.is_ascii_hexdigit()) { return None; }
    let data = [first.as_ptr(), second.as_ptr()]; let lengths = [first.len() as u32, second.len() as u32];
    // The signature field is zero-padded. Let CryptoAPI validate candidates instead of
    // parsing CMS/ASN.1 ourselves to determine where the DER object ends.
    let mut candidate_length = text.len();
    while candidate_length >= 2 {
        let candidate = decode_hex(&text[..candidate_length])?;
        unsafe {
            let mut parameters: CRYPT_VERIFY_MESSAGE_PARA = zeroed(); parameters.cbSize = size_of::<CRYPT_VERIFY_MESSAGE_PARA>() as u32; parameters.dwMsgAndCertEncodingType = X509_ASN_ENCODING | PKCS_7_ASN_ENCODING;
            let mut signer: *mut CERT_CONTEXT = ptr::null_mut();
            if CryptVerifyDetachedMessageSignature(&parameters, 0, candidate.as_ptr(), candidate.len() as u32, 2, data.as_ptr(), lengths.as_ptr(), &mut signer) != 0 && !signer.is_null() { return Some((signer, chain_trust(signer))); }
        }
        if !text[..candidate_length].ends_with("00") { break; }
        candidate_length -= 2;
    }
    None
}

#[cfg(target_os = "windows")]
fn decode_hex(value: &str) -> Option<Vec<u8>> {
    value.as_bytes().chunks_exact(2).map(|pair| { let text = std::str::from_utf8(pair).ok()?; u8::from_str_radix(text, 16).ok() }).collect()
}

#[cfg(target_os = "windows")]
fn invalid_verification(message: &str) -> PdfSignatureVerification { PdfSignatureVerification { integrity_valid: false, document_changed_after_signing: false, signer: None, certificate_fingerprint: None, trust: CertificateTrust::Unknown, certificate_status: CertificateStatus::MissingPrivateKey, message: message.to_string() } }

#[cfg(not(target_os = "windows"))]
pub fn verify_pdf(_: Vec<u8>) -> Result<Vec<PdfSignatureVerification>, String> { Err("PDF signature verification is available only on Windows.".to_string()) }

#[cfg(test)]
mod tests {
    use super::{locate_placeholder, svg_sha256};
    #[cfg(target_os = "windows")]
    use super::include_signing_certificate;
    #[cfg(target_os = "windows")]
    use std::{mem::zeroed, ptr};
    #[cfg(target_os = "windows")]
    use windows_sys::Win32::Security::Cryptography::{CERT_CONTEXT, CRYPT_SIGN_MESSAGE_PARA};

    #[test]
    fn svg_hash_is_stable_and_content_sensitive() {
        assert_eq!(svg_sha256("<svg><path d='M0 0'/></svg>"), svg_sha256("<svg><path d='M0 0'/></svg>"));
        assert_ne!(svg_sha256("<svg><path d='M0 0'/></svg>"), svg_sha256("<svg><path d='M1 1'/></svg>"));
    }

    #[test]
    fn locates_only_standard_placeholder() {
        let document = b"/ByteRange [ 0 /********** /********** /********** ] /Contents <0000>";
        let (_, _, start, end) = locate_placeholder(document).unwrap();
        assert_eq!(&document[start..=end], b"<0000>");
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn cms_signature_includes_its_signing_certificate() {
        let context = 1usize as *const CERT_CONTEXT;
        let mut parameters: CRYPT_SIGN_MESSAGE_PARA = unsafe { zeroed() };
        let mut certificates = [ptr::null_mut()];
        include_signing_certificate(&mut parameters, &mut certificates, context);
        assert_eq!(parameters.cMsgCert, 1);
        assert_eq!(certificates[0], context as *mut CERT_CONTEXT);
        assert_eq!(parameters.rgpMsgCert, certificates.as_mut_ptr());
    }

}
