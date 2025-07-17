{
  lib,
  stdenv,
  fetchFromGitHub,
  zig,
}:

stdenv.mkDerivation rec {
  pname = "supermd";
  version = "48500784d7706eaba2d5e1a35332353aca3fc04e";

  src = fetchFromGitHub {
    owner = "kristoff-it";
    repo = "supermd";
    rev = version;
    hash = "sha256-vz096tMSPwhiPTQdXpfPxvJ8clpYRglHUuiER/SmoW0=";
  };

  nativeBuildInputs = [
    zig.hook
  ];

  meta = with lib; {
    description = "SuperMD is an extension of Markdown used by https://zine-ssg.io";
    license = licenses.mit;
    maintainers = with maintainers; [ jaudiger ];
  };
}
