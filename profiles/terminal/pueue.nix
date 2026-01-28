# https://github.com/Nukesor/pueue
# Pueue is a command-line task management tool for sequential and parallel execution of long-running tasks.
{ ... }:

{
  modules.home-manager = {
    services.pueue = {
      enable = true;
    };
  };
}
