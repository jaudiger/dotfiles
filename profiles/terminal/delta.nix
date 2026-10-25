_:

{
  modules.home-manager = {
    programs.delta = {
      enable = true;
      enableGitIntegration = true;

      options = {
        line-numbers = true;
        navigate = false;
      };
    };
  };
}
