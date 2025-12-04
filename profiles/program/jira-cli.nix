{ config, pkgs, ... }:

let
  host = config.modules.host;
in
{
  modules = {
    home-manager = {
      home.packages = with pkgs; [
        jira-cli-go
      ];
    };
  };

  sops = {
    secrets = {
      # To edit the secret: "nix-shell -p sops --run 'sops secrets/jira-cli/credentials.yaml'"
      jira_api_token = {
        sopsFile = ../../secrets/jira-cli/credentials.yaml;

        owner = host.username;
        mode = "0400";
      };
    };
  };
}
