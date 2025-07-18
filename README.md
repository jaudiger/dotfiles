# All my personal dotfiles

Did I just say all ? Well, that's all my public dotfiles. Take care if you want to use them. They are not guaranteed to work on your system!

## CI / CD

The CI/CD pipeline is configured using GitHub Actions. The workflow is defined in the `.github/workflows` folder:

- Check Nix Flake update (run each week through CronJob)

Additionally, Dependabot is configured to automatically update dependencies (GitHub Actions, Terraform providers).

## Repository configuration

The settings of this repository are managed using Terraform. The configuration is located in the `.github/terraform` folder.
