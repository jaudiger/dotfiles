{ config, ... }:

let
  host = config.modules.host;
in
{
  modules.home-manager = {
    programs.ssh = {
      enable = true;
      enableDefaultConfig = false;

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

        "*" = {
          compression = true;
          serverAliveInterval = 20;
          serverAliveCountMax = 3;
          controlMaster = "auto";
          controlPersist = "10m";
          addKeysToAgent = "yes";

          # Use the keychain to store the passphrase on macOS, and make sure this key is ignored on Linux
          extraOptions = {
            "ForwardAgent" = "no";
            "HashKnownHosts" = "yes";
            "UserKnownHostsFile" = "${host.homeDirectory}/.ssh/known_hosts";
            "ControlPath" = "${host.homeDirectory}/.ssh/master-%r@%n:%p";
            "IgnoreUnknown" = "UseKeychain";
            "UseKeychain" = "yes";
          };
        };
      };
    };

    services = {
      ssh-agent = {
        enable = true;

        defaultMaximumIdentityLifetime = 7200; # 2 hours
      };
    };
  };
}
