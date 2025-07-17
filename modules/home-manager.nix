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
  };

  config = {
    home-manager = {
      useGlobalPkgs = true;
      useUserPackages = true;
      users.${host.username} = mkAliasDefinitions options.modules.home-manager;
    };
  };
}
