{ config, ... }:

let
  host = config.modules.host;
in
{
  modules.home-manager = {
    programs.ssh = {
      enable = true;
      compression = true;
      serverAliveInterval = 20;
      serverAliveCountMax = 3;
      controlMaster = "auto";
      controlPersist = "10m";
      addKeysToAgent = "confirm 2h";

      # Use the keychain to store the passphrase on macOS, and make sure this key is ignored on Linux
      extraConfig = ''
        IgnoreUnknown UseKeychain
        UseKeychain yes
      '';

      matchBlocks = {
        "github.com" = {
          hostname = "ssh.github.com";
          port = 443;
          identityFile = "${host.homeDirectory}/.ssh/id_ed25519";
          extraOptions = {
            "UpdateHostKeys" = "yes";
          };
        };

        "gitlab.com" = {
          hostname = "altssh.gitlab.com";
          port = 443;
          identityFile = "${host.homeDirectory}/.ssh/id_ed25519";
          extraOptions = {
            "UpdateHostKeys" = "yes";
          };
        };

        # Trasna GitLab instance
        "gitlab.trasna.services" = {
          hostname = "gitlab.trasna.services";
          port = 31444;
          identityFile = "${host.homeDirectory}/.ssh/id_ed25519";
          extraOptions = {
            "UpdateHostKeys" = "yes";
          };
        };

        "nixos" = {
          hostname = "192.168.64.4";
          port = 22;
          user = "jaudiger";
        };
      };
    };
  };
}
