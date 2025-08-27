{ ... }:

{
  modules = {
    home-manager = {
      programs.gemini-cli = {
        enable = true;
      };
    };
  };
}
