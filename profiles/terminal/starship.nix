{ ... }:

{
  modules.home-manager = {
    programs.starship = {
      enable = true;
      presets = [ "bracketed-segments" ];

      settings = {
        add_newline = false;
        command_timeout = 2000;
        continuation_prompt = "[.](bold yellow) ";
        format = "$all$cmd_duration$line_break$character";

        aws.disabled = true;
        azure.disabled = true;
        battery.disabled = true;
        container.disabled = true;
        docker_context.disabled = true;
        gcloud.disabled = true;
        nix_shell.disabled = true;
        openstack.disabled = true;
        package.disabled = true;

        character = {
          success_symbol = "[➜](bold green)";
          error_symbol = "[✗](bold red)";
        };

        cmd_duration = {
          min_time = 10000;
          format = "\\[[⏱ $duration]($style)\\]";
        };

        directory = {
          truncation_length = 5;
          truncation_symbol = "…/";
          format = "[$path]($style)[$lock_symbol]($lock_style) ";
        };

        git_branch = {
          symbol = "";
          style = "bold yellow";
        };

        git_commit = {
          tag_symbol = "";
          style = "bold white";
          only_detached = false;
          tag_disabled = false;
          format = "[\\($hash\\)]($style)( [\\($tag\\)]($style))";
        };

        git_metrics = {
          disabled = false;
          added_style = "bold dimmed green";
          deleted_style = "bold dimmed red";
          format = "\\([+$added]($added_style)/[-$deleted]($deleted_style)\\)";
        };

        git_state = {
          format = "[\\($state ($progress_current/$progress_total)\\)]($style) ";
        };

        git_status = {
          conflicted = "=$count";
          ahead = "↑$count";
          behind = "↓$count";
          diverged = "↑$ahead_count↓$behind_count";
          untracked = "?$count";
          stashed = "*";
          modified = "!$count";
          staged = "+$count";
          renamed = "»$count";
          deleted = "✘$count";
          style = "bold yellow";
        };

        hostname = {
          format = "@[$hostname]($style): ";
          style = "bold dimmed white";
        };


        username = {
          format = "[$user]($style)";
          style_user = "bold dimmed yellow";
        };
      };
    };
  };
}
