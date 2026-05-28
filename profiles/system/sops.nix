{ config, pkgs, ... }:

let
  host = config.modules.host;
in
{
  modules.home-manager.home.packages = with pkgs; [
    sops
    ssh-to-age
  ];

  sops = {
    gnupg = {
      home = "${host.homeDirectory}/.gnupg";
      sshKeyPaths = [ ]; # Disable importing gpg ssh keys
    };

    age.sshKeyPaths = [ ]; # Disable importing age ssh keys
  };
}
