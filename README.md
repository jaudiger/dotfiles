# All my personal dotfiles

Did I just say all ? Well, that's all my public dotfiles. Take care if you want to use them. They are not guaranteed to work on your system!

Some parts of the configuration are not public and are encrypted using [sops](https://github.com/getsops/sops). The enciphered files are stored in the [`secrets`](secrets) folder. In order to deploy locally, the integration layer between the secrets and the dotfiles relies on [sops-nix](https://github.com/Mic92/sops-nix).

## CI / CD

The CI/CD pipeline is configured using GitHub Actions. The workflow is defined in the [`.github/workflows`](.github/workflows) folder:

- Static Analysis (GitHub Actions)
- Check Nix Flake update (run each week through CronJob)

Additionally, Dependabot is configured to automatically update dependencies (GitHub Actions, Terraform providers).

## Repository configuration

The settings of this repository are managed from the [gitops-deployments](https://github.com/jaudiger/gitops-deployments) repository using Terraform. The actual configuration applied is located in the Terraform module [`modules/github-repository`](https://github.com/jaudiger/gitops-deployments/tree/main/modules/github-repository).
