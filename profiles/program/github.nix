{ ... }:

{
  modules = {
    home-manager = {
      programs.gh = {
        enable = true;

        gitCredentialHelper = {
          enable = false;
        };
      };
    };
  };
}
