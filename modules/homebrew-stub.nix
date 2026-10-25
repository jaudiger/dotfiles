# Stub module for homebrew options
{
  lib,
  ...
}:

{
  options.homebrew = {
    taps = lib.mkOption {
      type = lib.types.listOf lib.types.str;
      default = [ ];
      description = "Homebrew taps to install (Darwin only, stub on NixOS)";
    };

    brews = lib.mkOption {
      type = lib.types.listOf lib.types.str;
      default = [ ];
      description = "Homebrew formulae to install (Darwin only, stub on NixOS)";
    };

    casks = lib.mkOption {
      type = lib.types.listOf lib.types.str;
      default = [ ];
      description = "Homebrew casks to install (Darwin only, stub on NixOS)";
    };
  };
}
