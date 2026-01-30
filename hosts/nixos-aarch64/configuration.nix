{ config, ... }:

let
  host = config.modules.host;
in
{
  config = {
    # Default config
    modules = {
      host = {
        username = "jaudiger";

        security = {
          authorizedKeys = [
            "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABgQDW1eisXjbeqHKPTgpeInpxgZe8Bot9RYW7N27Rd+5x2O51GpEA6j3oyNPRcDj5i7SZxfhWas6XV9W0RFkeH9+ECGtDvxkpbmuZ9yUCXVw0RjJ2QuKqbf43oHtHDOLHyQQ/TaJnOVf0DEIg7cPEY6vOviC9lgbsmgs+WCJgNvYbh8rmFrEUZHAv+ggx7zsHhxX+iZ+sbiUcQqKw/rZDy5+Nc9U5F5G+joY0fW9lHClMIZvY3uZTzSaHi65PqpYp9Zfvs7oTxL2n+HvqhOpFQw8gXqVO1bE408U4P07xidH5LRQdXYFdrGxJOj+D1kLUpDjL4tcsm6ygSyf2OL8OPI9SO3ZYxQnw0PHhh5Z4M1yMplx3oUzn2OUMSsmIIIss5nWSfGZMCwO3xGIbZ/dvewcJQGa5tcWPh7Mbs8aYgtS8CLz2/ByuUEePW47kod8aJqU3P9JOlvju1hBIxNz61a2sUL9fUIiyuMyOzxnroPZpgpyhveHzN15vdqWEX+afJE0= jaudiger@mbp-de-jeremy.home"
          ];
          gpgSshKeys = [ "03A1DE1EF8BA638463AF96D137ADB364FD4E605B" ];
        };
      };
    };

    # Sharing from host
    fileSystems."/home/jaudiger/Development" = {
      device = "share";
      fsType = "9p";
      options = [
        "trans=virtio"
        "version=9p2000.L"
        "posixacl"
        "msize=104857600"
        "cache=loose"
      ];
    };

    boot.loader = {
      systemd-boot.enable = true;
      efi.canTouchEfiVariables = true;
    };

    # Set your time zone
    time.timeZone = "Europe/Paris";

    # Select internationalization
    i18n.defaultLocale = "en_US.UTF-8";

    # Select keyboard
    services.xserver.xkb = {
      model = "pc105";
      layout = "fr";
      variant = "mac";
    };

    console.keyMap = "fr";

    networking.hostName = "${host.username}";
    networking.networkmanager.enable = true;

    users.users.${host.username} = {
      isNormalUser = true;
      extraGroups = [
        "networkmanager"
        "wheel"
      ];
    };

    # To enable the auto login at boot
    services.getty.autologinUser = "${host.username}";

    system = {
      # This value determines the NixOS release from which the default
      # settings for stateful data, like file locations and database versions
      # on your system were taken. It‘s perfectly fine and recommended to leave
      # this value at the release version of the first install of this system.
      # Before changing this value read the documentation for this option
      # (e.g. man configuration.nix or on https://nixos.org/nixos/options.html).
      stateVersion = "26.05";
    };
  };

  # Import files to setup the environment
  imports = [
    ../../profiles/ai/default.nix
    ../../profiles/cloud/default.nix
    ../../profiles/editors/default.nix
    ../../profiles/misc/default.nix
    ../../profiles/system/default.nix
    ../../profiles/terminal/default.nix
    ../../profiles/toolchains/default.nix
    ../../profiles/vcs/default.nix
    ../../profiles/virtualization/default.nix
  ];
}
