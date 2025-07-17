{ config, pkgs, ... }:

let
  host = config.modules.host;
in
{
  # Per GitLab documentation, this is required in order to clone private repositories using Go tools:
  # https://docs.gitlab.com/user/project/use_project_as_go_package/?utm_source=chatgpt.com#authenticate-go-requests-to-private-projects
  sops = {
    # To decrypt the secret: "nix-shell -p sops --run 'sops -d secrets/.netrc'"
    # To encrypt the secret: "nix-shell -p sops --run 'sops -e secrets/.netrc' > secrets/.netrc"
    secrets.netrc = {
      sopsFile = ../../secrets/.netrc;
      format = "binary";

      path = "${host.homeDirectory}/.netrc";
      owner = host.username;
      mode = "0600";
    };
  };

  modules.home-manager.home = {
    packages = with pkgs; [
      go
      delve
      gopls

      gotools
      golangci-lint
      gosec
    ];
  };
}
