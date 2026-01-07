# Stub module for homebrew options 
{
  lib,
  ...
}:

{
  options.homebrew = {
    casks = lib.mkOption {
      type = lib.types.listOf lib.types.str;
      default = [ ];
      description = "Homebrew casks to install (Darwin only, stub on NixOS)";
    };
  };
}
