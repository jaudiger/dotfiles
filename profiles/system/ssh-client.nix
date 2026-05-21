{ config, ... }:

let
  host = config.modules.host;
in
{
  modules.home-manager = {
    programs.ssh = {
      enable = true;
      enableDefaultConfig = false;

      settings = {
        "github.com" = {
          HostName = "ssh.github.com";
          Port = 443;
          IdentityFile = "${host.homeDirectory}/.ssh/id_ed25519";
          UpdateHostKeys = "yes";
        };

        "gitlab.com" = {
          HostName = "altssh.gitlab.com";
          Port = 443;
          IdentityFile = "${host.homeDirectory}/.ssh/id_ed25519";
          UpdateHostKeys = "yes";
        };

        # Trasna GitLab instance
        "gitlab.trasna.services" = {
          HostName = "gitlab.trasna.services";
          Port = 31444;
          IdentityFile = "${host.homeDirectory}/.ssh/id_ed25519";
          UpdateHostKeys = "yes";
        };

        # Use the keychain to store the passphrase on macOS, and make sure this key is ignored on Linux
        "*" = {
          Compression = true;
          ServerAliveInterval = 20;
          ServerAliveCountMax = 3;
          ControlMaster = "auto";
          ControlPersist = "10m";
          AddKeysToAgent = "yes";
          IdentitiesOnly = true;
          ForwardAgent = "no";
          HashKnownHosts = "yes";
          UserKnownHostsFile = "${host.homeDirectory}/.ssh/known_hosts";
          ControlPath = "${host.homeDirectory}/.ssh/master-%r@%n:%p";
          IgnoreUnknown = "UseKeychain";
          UseKeychain = "yes";
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
