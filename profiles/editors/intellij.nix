{
  config,
  pkgs,
  lib,
  ...
}:

let
  isDarwin = config.nixpkgs.hostPlatform.isDarwin;
  isLinux = config.nixpkgs.hostPlatform.isLinux;
in
{
  homebrew = lib.mkIf isDarwin {
    casks = [ "intellij-idea-ce" ];
  };

  modules.host.unfreePackages = lib.optionals isLinux [ "idea" ];

  modules.home-manager.home.packages = lib.optionals isLinux [
    pkgs.jetbrains.idea
  ];

  modules.host.shell.nonPortableAliases = lib.mkIf isDarwin {
    intellij = "open -na 'IntelliJ IDEA CE'";
  };
}
