{
  config,
  pkgs,
  lib,
  ...
}:

with lib;

let
  isDarwin = pkgs.stdenv.isDarwin;
  host = config.modules.host;
in
{
  options.modules.host = {
    username = mkOption {
      type = types.str;
      description = ''
        The primary username for this host.
      '';
    };
    homeDirectory = mkOption {
      type = types.str;
      default = if isDarwin then "/Users/${host.username}" else "/home/${host.username}";
      description = ''
        The absolute path to the user's home directory.
      '';
    };
    dotfilesDirectory = mkOption {
      type = types.str;
      default = "${host.homeDirectory}/Development/git-repositories/jaudiger/dotfiles";
      description = ''
        The absolute path to the dotfiles repository.
      '';
    };

    shell = {
      aliases = mkOption {
        type = types.attrsOf types.str;
        default = { };
        description = ''
          Portable shell aliases applied to all configured shells. These should work across all POSIX-compatible systems.
        '';
      };

      nonPortableAliases = mkOption {
        type = types.attrsOf types.str;
        default = { };
        description = ''
          Platform or host-specific shell aliases applied.
        '';
      };

      sessionVariables = mkOption {
        type = types.attrsOf types.str;
        default = { };
        description = ''
          Environment variables exported in the shell session.
        '';
      };
    };

    security = {
      authorizedKeys = mkOption {
        type = types.listOf types.str;
        default = [ ];
        description = ''
          List of SSH public keys authorized to access this host.
        '';
      };

      gpgSshKeys = mkOption {
        type = types.listOf types.str;
        default = [ ];
        description = ''
          List of GPG key grips for SSH authentication via gpg-agent.
        '';
      };
    };
  };
}
