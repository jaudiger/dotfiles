{ ... }:

{
  modules.home-manager = {
    services.espanso = {
      enable = true;

      configs = {
        default = {
          search_shortcut = "off";
        };
      };

      matches = {
        base = {
          matches = [
            {
              trigger = ":lenny";
              form = "[[smileys]]";
              form_fields = {
                smileys = {
                  type = "choice";
                  values = [
                    "¯\_(ツ)_/¯"
                    "(╯°□°）╯︵ ┻━┻"
                    "( ͡ಠ ʖ̯ ͡ಠ)"
                    "☉ ‿ ⚆"
                    "ʕ•ᴥ•ʔ"
                    "⋆｡˚ ☁︎ ˚｡⋆｡˚☽˚｡⋆"
                    "(づᵔ◡ᵔ)づ"
                    "|ᵔ‿ᵔ|"
                    "⤜(*﹏*)⤏"
                    "ツ"
                  ];
                };
              };
            }
          ];
        };
      };
    };
  };
}
