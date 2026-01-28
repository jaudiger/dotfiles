{ ... }:

{
  modules.home-manager = {
    programs.starship = {
      enable = true;

      settings = {
        add_newline = false;
        command_timeout = 2000;
        continuation_prompt = "[.](bold yellow) ";

        aws = {
          disabled = true;
          format = "\\[[$symbol($profile)(\\($region\\))(\\[$duration\\])]($style)\\]";
        };

        azure = {
          disabled = true;
          format = "\\[[$symbol($subscription)]($style)\\]";
        };

        battery = {
          full_symbol = "🔋";
          charging_symbol = "🔌";
          discharging_symbol = "⚡";
        };

        battery.display = [
          {
            threshold = 30;
            style = "bold red";
          }
        ];

        buf = {
          format = "\\[[$symbol($version)]($style)\\]";
        };

        bun = {
          format = "\\[[$symbol($version)]($style)\\]";
        };

        c = {
          format = "\\[[$symbol($version(-$name))]($style)\\]";
        };

        character = {
          success_symbol = "[➜](bold green)";
          error_symbol = "[✗](bold red)";
        };

        cmake = {
          format = "\\[[$symbol($version)]($style)\\]";
        };

        cmd_duration = {
          min_time = 10000;
          format = "[⏱ $duration]($style)";
        };

        cobol = {
          format = "\\[[$symbol($version)]($style)\\]";
        };

        conda = {
          format = "\\[[$symbol$environment]($style)\\]";
        };

        container = {
          disabled = true;
          format = "\\[[$symbol \\[$name\\]]($style)\\]";
        };

        cpp = {
          format = "\\[[$symbol($version(-$name))]($style)\\]";
        };

        crystal = {
          format = "\\[[$symbol($version)]($style)\\]";
        };

        daml = {
          format = "\\[[$symbol($version)]($style)\\]";
        };

        dart = {
          format = "\\[[$symbol($version)]($style)\\]";
        };

        deno = {
          format = "\\[[$symbol($version)]($style)\\]";
        };

        directory = {
          truncation_length = 5;
          truncation_symbol = "…/";
          truncate_to_repo = true;
          format = "[$path]($style)[$lock_symbol]($lock_style) ";
        };

        direnv = {
          format = "\\[[$symbol$loaded/$allowed]($style)\\]";
        };

        docker_context = {
          disabled = true;
          format = "\\[[$symbol$context]($style)\\]";
        };

        dotnet = {
          format = "\\[[$symbol($version)(🎯 $tfm)]($style)\\]";
        };

        elixir = {
          format = "\\[[$symbol($version \\(OTP $otp_version\\))]($style)\\]";
        };

        elm = {
          format = "\\[[$symbol($version)]($style)\\]";
        };

        erlang = {
          format = "\\[[$symbol($version)]($style)\\]";
        };

        fennel = {
          format = "\\[[$symbol($version)]($style)\\]";
        };

        fortran = {
          format = "\\[[$symbol($version)]($style)\\]";
        };

        fossil_branch = {
          format = "\\[[$symbol$branch]($style)\\]";
        };

        fossil_metrics = {
          format = "\\[[+$added]($added_style)\\]/\\[[-$deleted]($deleted_style)\\]";
        };

        gcloud = {
          disabled = true;
          format = "\\[[$symbol$account(@$domain)(\\($region\\))]($style)\\]";
        };

        git_branch = {
          format = "\\[[$symbol$branch]($style)\\]";
          symbol = "🌱 ";
          style = "bold yellow";
        };

        git_commit = {
          commit_hash_length = 7;
          tag_symbol = "🔖";
          style = "bold white";
          only_detached = false;
          tag_disabled = false;
          format = "[\\($hash\\)]($style)( [\\($tag\\)]($style))";
        };

        git_metrics = {
          disabled = false;
          added_style = "bold dimmed green";
          deleted_style = "bold dimmed red";
          only_nonzero_diffs = false;
          format = "\\([+$added]($added_style)/[-$deleted]($deleted_style)\\)";
        };

        git_state = {
          format = "[\\($state ($progress_current/$progress_total)\\)]($style) ";
        };

        git_status = {
          conflicted = "⚔️";
          ahead = "🏎️💨×$count";
          behind = "🐢×$count";
          diverged = "🏎️💨×$ahead_count 🐢×$behind_count";
          untracked = "🛤️";
          stashed = "📦";
          modified = "📝×$count";
          staged = "🗃️×$count";
          renamed = "📛×$count";
          deleted = "🗑️×$count";
          style = "bold white";
          format = "([\\[$all_status$ahead_behind\\]]($style))";
        };

        gleam = {
          format = "\\[[$symbol($version)]($style)\\]";
        };

        golang = {
          format = "\\[[$symbol($version)]($style)\\]";
        };

        gradle = {
          format = "\\[[$symbol($version)]($style)\\]";
        };

        guix_shell = {
          format = "\\[[$symbol]($style)\\]";
        };

        haskell = {
          format = "\\[[$symbol($version)]($style)\\]";
        };

        haxe = {
          format = "\\[[$symbol($version)]($style)\\]";
        };

        helm = {
          format = "\\[[$symbol($version)]($style)\\]";
        };

        hg_branch = {
          format = "\\[[$symbol$branch]($style)\\]";
        };

        hostname = {
          disabled = false;
          ssh_only = false;
          format = "@[$hostname]($style): ";
          trim_at = ".";
          style = "bold dimmed white";
        };

        java = {
          format = "\\[[$symbol($version)]($style)\\]";
        };

        jobs = {
          format = "\\[[$symbol$number]($style)\\]";
        };

        julia = {
          format = "\\[[$symbol($version)]($style)\\]";
        };

        kotlin = {
          format = "\\[[$symbol($version)]($style)\\]";
        };

        kubernetes = {
          format = "\\[[$symbol$context( \\($namespace\\))]($style)\\]";
        };

        line_break = {
          disabled = false;
        };

        localip = {
          format = "\\[[$localipv4]($style)\\]";
        };

        lua = {
          format = "\\[[$symbol($version)]($style)\\]";
        };

        memory_usage = {
          disabled = false;
          format = "\\[$symbol[$ram( | $swap)]($style)\\]";
          threshold = 70;
          symbol = "";
          style = "bold dimmed white";
        };

        meson = {
          format = "\\[[$symbol$project]($style)\\]";
        };

        mise = {
          format = "\\[[$symbol$health]($style)\\]";
        };

        mojo = {
          format = "\\[[$symbol($version)]($style)\\]";
        };

        nats = {
          format = "\\[[$symbol$name]($style)\\]";
        };

        netns = {
          format = "\\[[$symbol \\[$name\\]]($style)\\]";
        };

        nim = {
          format = "\\[[$symbol($version)]($style)\\]";
        };

        nix_shell = {
          disabled = true;
          format = "\\[[$symbol$state( \\($name\\))]($style)\\]";
        };

        nodejs = {
          format = "\\[[$symbol($version)]($style)\\]";
        };

        ocaml = {
          format = "\\[[$symbol($version)(\\($switch_indicator$switch_name\\))]($style)\\]";
        };

        odin = {
          format = "\\[[$symbol($version)]($style)\\]";
        };

        opa = {
          format = "\\[[$symbol($version)]($style)\\]";
        };

        openstack = {
          disabled = true;
          format = "\\[[$symbol$cloud(\\($project\\))]($style)\\]";
        };

        os = {
          format = "\\[[$symbol]($style)\\]";
        };

        package = {
          disabled = true;
          format = "\\[[$symbol$version]($style)\\]";
        };

        perl = {
          format = "\\[[$symbol($version)]($style)\\]";
        };

        php = {
          format = "\\[[$symbol($version)]($style)\\]";
        };

        pijul_channel = {
          format = "\\[[$symbol$channel]($style)\\]";
        };

        pixi = {
          format = "\\[[$symbol$version( $environment)]($style)\\]";
        };

        pulumi = {
          format = "\\[[$symbol$stack]($style)\\]";
        };

        purescript = {
          format = "\\[[$symbol($version)]($style)\\]";
        };

        python = {
          format = "\\[[$symbol$pyenv_prefix($version)(\\($virtualenv\\))]($style)\\]";
        };

        quarto = {
          format = "\\[[$symbol($version)]($style)\\]";
        };

        raku = {
          format = "\\[[$symbol($version-$vm_version)]($style)\\]";
        };

        red = {
          format = "\\[[$symbol($version)]($style)\\]";
        };

        rlang = {
          format = "\\[[$symbol($version)]($style)\\]";
        };

        ruby = {
          format = "\\[[$symbol($version)]($style)\\]";
        };

        rust = {
          format = "\\[[$symbol($version)]($style)\\]";
        };

        scala = {
          format = "\\[[$symbol($version)]($style)\\]";
        };

        shell = {
          format = "\\[[$indicator]($style)\\]";
        };

        singularity = {
          format = "\\[[$symbol\\[$env\\]]($style)\\]";
        };

        solidity = {
          format = "\\[[$symbol($version)]($style)\\]";
        };

        spack = {
          format = "\\[[$symbol$environment]($style)\\]";
        };

        status = {
          format = "\\[[$symbol$status]($style)\\]";
        };

        sudo = {
          disabled = false;
          format = "[$symbol]($style)";
        };

        swift = {
          format = "\\[[$symbol($version)]($style)\\]";
        };

        terraform = {
          format = "\\[[$symbol$workspace]($style)\\]";
        };

        time = {
          disabled = true;
          format = "\\[[$time]($style)\\]";
          time_format = "%H:%M";
        };

        typst = {
          format = "\\[[$symbol($version)]($style)\\]";
        };

        username = {
          format = "[$user]($style)";
          style_user = "bold dimmed yellow";
          show_always = true;
        };

        vagrant = {
          format = "\\[[$symbol($version)]($style)\\]";
        };

        vcsh = {
          format = "\\[vcsh [$symbol$repo]($style)\\]";
        };

        vlang = {
          format = "\\[[$symbol($version)]($style)\\]";
        };

        xmake = {
          format = "\\[[$symbol($version)]($style)\\]";
        };

        zig = {
          format = "\\[[$symbol($version)]($style)\\]";
        };
      };
    };
  };
}
