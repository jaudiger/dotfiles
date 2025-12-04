{ config, ... }:

let
  host = config.modules.host;
in
{
  modules = {
    home-manager = {
      programs.gh = {
        enable = true;

        gitCredentialHelper = {
          enable = false;
        };
      };
    };
  };

  sops = {
    secrets = {
      # To edit the secret: "nix-shell -p sops --run 'sops secrets/github/credentials.yaml'"
      github_personal_access_token = {
        sopsFile = ../../secrets/github/credentials.yaml;

        owner = host.username;
        mode = "0400";
      };
    };
  };
}
