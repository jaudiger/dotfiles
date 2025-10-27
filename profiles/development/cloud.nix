{ pkgs, ... }:

{
  modules.home-manager.home = {
    packages = with pkgs; [
      # Manage certificates of Kubernetes clusters
      cmctl

      # Detect unused resources in Kubernetes clusters
      kor

      # Security scanners
      hadolint
      trivy

      # GitHub Actions workflow linter
      actionlint

      # Cloudflare Pages deployment
      wrangler
    ];
  };
}
