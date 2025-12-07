{
  config,
  lib,
  options,
  ...
}:

with lib;

let
  host = config.modules.host;
in
{
  options.modules.home-manager = mkOption {
    type = types.attrs;
    default = { };
    description = ''
      Home-manager configuration module that gets merged into the user's
      home-manager config. Accepts any valid home-manager module (attribute
      set or function).
    '';
  };

  config = {
    home-manager = {
      useGlobalPkgs = true;
      useUserPackages = true;
      users.${host.username} = mkAliasDefinitions options.modules.home-manager;
    };
  };
}
