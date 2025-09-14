{
  lib,
  stdenv,
  fetchFromGitHub,
  zig,
}:

stdenv.mkDerivation rec {
  pname = "supermd";
  version = "e74d65e3cdf3a1c89e3f627b700b901896ee04f6";

  src = fetchFromGitHub {
    owner = "kristoff-it";
    repo = "supermd";
    rev = version;
    hash = "sha256-D7/QNrogvvsXDzYN+/KWoWUBe0Vs/TAADtuEm+Dr35E=";
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
