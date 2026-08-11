# Certificate management

## Certificate wallet

Open **Settings → Digital Certificates** to manage certificates. The wallet stores only profile metadata in EasySamnao app data: certificate fingerprint, public certificate details, display name, status, and an optional SVG binding. It does not store raw private keys or P12/PFX passwords.

### Create a personal certificate

Creating a certificate asks for a name, optional email/organization, validity period, and optional SVG. EasySamnao asks Windows to create an RSA-3072, SHA-256, digital-signature certificate in `CurrentUser\My`. Its key is marked non-exportable by default and remains in Windows key storage.

The generated certificate is self-signed. It can prove that the matching key signed an unchanged PDF, but it does not create an externally verified identity. For externally trusted identity, import a certificate issued by the appropriate certificate authority.

### Import or discover

- **Import P12/PFX** validates the container and password, previews the certificate, then adds it to the Windows personal store. The password is never persisted or logged.
- **Use Windows Certificate** discovers personal-store certificates with an accessible private key and adds non-secret references to the EasySamnao wallet.

### Lifecycle

| Action                    | Behaviour                                                                                                                                                   |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Renew                     | Creates a new key and certificate; it does not extend the old certificate. It may carry the current SVG binding after the current SVG hash is checked.      |
| Retire / Mark compromised | Local EasySamnao status. It prevents new signing here but does not revoke a certificate globally.                                                           |
| Export `.cer`             | Exports only the public certificate.                                                                                                                        |
| Export `.p12`             | Requires a non-empty password and explicit warning. Non-exportable Windows keys are refused.                                                                |
| Remove from EasySamnao    | Removes the local profile only. The Windows certificate and key remain intact.                                                                              |
| Delete from Windows       | Requires typing `DELETE CERTIFICATE`; asks Windows to delete the certificate and private-key container. If Windows refuses, the EasySamnao profile remains. |

EasySamnao never deletes Windows private keys automatically. **Delete from Windows** is deliberately destructive and can make historical documents unverifiable with that key.

## Status and trust

Certificate state and trust are separate.

- State: active, expiring, expired, retired, compromised, revoked, or missing private key.
- Trust: self-signed, trusted, untrusted, or unknown.

Windows chain validation performs the available chain and revocation checks. Network or issuer limitations can leave trust unknown; that is not treated as trusted. Expired, retired, compromised, revoked, and keyless certificates cannot create new signatures in the normal workflow.

## Bound handwritten signature

The wallet shows the linked SVG and its SHA-256 value. If the encrypted SVG payload changes or disappears, the link is shown as changed/missing and cannot be used for signed export until a user reviews and explicitly re-binds it.
