{ ... }:

{
  modules.home-manager = {
    programs.mergiraf = {
      enable = true;

      enableGitIntegration = true;
      enableJujutsuIntegration = true;
    };
  };
}
