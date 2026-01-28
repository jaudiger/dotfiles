{ config, pkgs, ... }:

let
  host = config.modules.host;
in
{
  modules = {
    home-manager = {
      home.packages = with pkgs; [
        # NOTE: 'glab config -g set check_update false' needs to be run after installation
        glab

        gitlab-ci-linter
      ];
    };
  };

  sops = {
    secrets = {
      # To edit the secret: "nix-shell -p sops --run 'sops secrets/gitlab/credentials.yaml'"
      gitlab_personal_access_token = {
        sopsFile = ../../secrets/gitlab/credentials.yaml;

        owner = host.username;
        mode = "0400";
      };
    };
  };
}
