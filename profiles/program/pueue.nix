# https://github.com/Nukesor/pueue
# Pueue is a command-line task management tool for sequential and parallel execution of long-running tasks.
{ pkgs, ... }:

{
  modules.home-manager = {
    home = {
      packages = with pkgs; [ pueue ];
    };
  };
}
