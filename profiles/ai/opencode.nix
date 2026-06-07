_:

{
  modules = {
    home-manager = {
      programs.opencode = {
        enable = true;

        settings = {
          autoupdate = false;
        };
      };
    };
  };
}
