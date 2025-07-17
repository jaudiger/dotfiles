{ config, ... }:

let
  host = config.modules.host;
in
{
  sops = {
    gnupg = {
      home = "${host.homeDirectory}/.gnupg";
      sshKeyPaths = [ ]; # Disable importing gpg ssh keys
    };

    age.sshKeyPaths = [ ]; # Disable importing age ssh keys
  };
}
