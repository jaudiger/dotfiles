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
    username = mkOption { type = types.str; };
    homeDirectory = mkOption {
      type = types.str;
      default = if isDarwin then "/Users/${host.username}" else "/home/${host.username}";
    };

    shell = {
      aliases = mkOption {
        type = types.attrsOf types.str;
        default = { };
      };

      nonPortableAliases = mkOption {
        type = types.attrsOf types.str;
        default = { };
      };

      sessionVariables = mkOption {
        type = types.attrsOf types.str;
        default = { };
      };
    };

    security = {
      authorizedKeys = mkOption {
        type = types.listOf types.str;
        default = [ ];
      };

      gpgSshKeys = mkOption {
        type = types.listOf types.str;
        default = [ ];
      };
    };
  };
}
