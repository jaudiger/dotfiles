{
  lib,
  stdenv,
  fetchFromGitHub,
  zig,
}:

stdenv.mkDerivation rec {
  pname = "zine";
  version = "b96e930630f8237aa4927fe14b9cb227061155d3";

  src = fetchFromGitHub {
    owner = "kristoff-it";
    repo = "zine";
    rev = version;
    hash = "sha256-G6gdaVQWyX+0H3wRhCt3vgMA8IXJRjkjbZcPzlou+Ek=";
  };

  nativeBuildInputs = [
    zig.hook
  ];

  meta = with lib; {
    description = "Fast, Scalable, Flexible Static Site Generator (SSG)";
    homepage = "https://zine-ssg.io";
    license = licenses.mit;
    maintainers = with maintainers; [ jaudiger ];
  };
}
