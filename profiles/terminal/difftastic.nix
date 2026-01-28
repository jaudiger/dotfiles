{ ... }:

{
  modules.home-manager = {
    programs.difftastic = {
      enable = true;

      git.enable = true;
    };
  };
}
