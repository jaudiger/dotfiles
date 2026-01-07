# Stub module for homebrew options
{
  lib,
  ...
}:

{
  options.homebrew = {
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
