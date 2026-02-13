# All my personal dotfiles

Did I just say all ? Well, that's all my public dotfiles. Take care if you want to use them. They are not guaranteed to work on your system!

Some parts of the configuration are not public and are encrypted using [sops](https://github.com/getsops/sops). The enciphered files are stored in the [`secrets`](secrets) folder. In order to deploy locally, the integration layer between the secrets and the dotfiles relies on [sops-nix](https://github.com/Mic92/sops-nix).

## Installation

### Prerequisites

Install Homebrew (only on macOS):

```bash
bash <(curl --proto '=https' --tlsv1.2 -L https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)
```

Install Nix:

```bash
sh <(curl --proto '=https' --tlsv1.2 -L https://nixos.org/nix/install)
```

### Available hosts

| Host | Platform |
|------|----------|
| `darwin-aarch64` | macOS (Apple Silicon) |
| `nixos-aarch64` | NixOS (ARM64) |

### Initial bootstrap

Start an ephemeral Nix shell with GPG, import your private key, then run the first switch — all from the same shell session:

```bash
nix --extra-experimental-features 'flakes nix-command' shell nixpkgs#gnupg

gpg --import /path/to/private-key.asc
```

On macOS:

```bash
sudo nix --extra-experimental-features 'flakes nix-command' run nix-darwin -- switch --flake github:jaudiger/dotfiles#<HOST>
```

On NixOS:

```bash
sudo nixos-rebuild switch --flake github:jaudiger/dotfiles#<HOST>
```

Replace `<HOST>` with the appropriate host name from the table above.

### After bootstrap

Once the initial bootstrap is complete, clone the repository and use the `nix-update` alias to apply configuration changes:

```bash
nix-update
```

This alias is platform-aware and will invoke the correct rebuild command for the current environment.

## CI / CD

The CI/CD pipeline is configured using GitHub Actions. The workflow is defined in the [`.github/workflows`](.github/workflows) folder:

- Static Analysis (GitHub Actions)
- Check Nix Flake update (run each week through CronJob)

Additionally, Dependabot is configured to automatically update dependencies (GitHub Actions, Terraform providers).

## Repository configuration

The settings of this repository are managed from the [gitops-deployments](https://github.com/jaudiger/gitops-deployments) repository using Terraform. The actual configuration applied is located in the Terraform module [`modules/github-repository`](https://github.com/jaudiger/gitops-deployments/tree/main/modules/github-repository).
