{ ... }:

{
  modules.home-manager = {
    programs.eza = {
      enable = true;

      extraOptions = [ "--group-directories-first" ];
      colors = "auto";
      icons = "auto";
      git = true;
    };
  };
}
